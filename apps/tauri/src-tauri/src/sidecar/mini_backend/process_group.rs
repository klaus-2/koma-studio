#[cfg(windows)]
mod platform {
    use std::{mem::size_of, ptr};

    use windows_sys::Win32::{
        Foundation::{CloseHandle, GetLastError, HANDLE},
        System::{
            JobObjects::{
                AssignProcessToJobObject, CreateJobObjectW, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
                JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JobObjectExtendedLimitInformation,
                SetInformationJobObject, TerminateJobObject,
            },
            Threading::{OpenProcess, PROCESS_SET_QUOTA, PROCESS_TERMINATE},
        },
    };

    #[derive(Debug)]
    pub(crate) struct SidecarJobObject(HANDLE);

    // SAFETY: `SidecarJobObject` owns the Win32 kernel handle exclusively and
    // closes it on drop, so transferring it between threads is sound.
    unsafe impl Send for SidecarJobObject {}
    // SAFETY: Win32 job handles synchronize kernel operations safely under the
    // surrounding mutex.
    unsafe impl Sync for SidecarJobObject {}

    struct ProcessHandle(HANDLE);

    impl Drop for ProcessHandle {
        fn drop(&mut self) {
            if !self.0.is_null() {
                // SAFETY: `self.0` was opened with `OpenProcess` and is closed once.
                unsafe {
                    CloseHandle(self.0);
                }
            }
        }
    }

    impl SidecarJobObject {
        pub(crate) fn create() -> Result<Self, String> {
            // SAFETY: null security attributes and null name create an anonymous job object.
            let handle = unsafe { CreateJobObjectW(ptr::null(), ptr::null()) };
            if handle.is_null() {
                // SAFETY: `GetLastError` reads the calling thread's last-error code.
                let code = unsafe { GetLastError() };
                return Err(format!("CreateJobObjectW failed with Win32 error {code}"));
            }
            let job = Self(handle);

            // SAFETY: `JOBOBJECT_EXTENDED_LIMIT_INFORMATION` is a plain Win32 struct.
            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = unsafe { std::mem::zeroed() };
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

            // SAFETY: `job.0` is valid and `info` matches `JobObjectExtendedLimitInformation`.
            let ok = unsafe {
                SetInformationJobObject(
                    job.0,
                    JobObjectExtendedLimitInformation,
                    (&raw const info).cast(),
                    size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                )
            };
            if ok == 0 {
                // SAFETY: `GetLastError` reads the calling thread's last-error code.
                let code = unsafe { GetLastError() };
                return Err(format!(
                    "SetInformationJobObject failed with Win32 error {code}"
                ));
            }
            Ok(job)
        }

        pub(crate) fn assign_pid(&self, pid: u32) -> Result<(), String> {
            // SAFETY: opens the spawned child PID with rights required by `AssignProcessToJobObject`.
            let raw_proc = unsafe { OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, 0, pid) };
            if raw_proc.is_null() {
                // SAFETY: `GetLastError` reads the calling thread's last-error code.
                let code = unsafe { GetLastError() };
                return Err(format!("OpenProcess({pid}) failed with Win32 error {code}"));
            }
            let proc = ProcessHandle(raw_proc);

            // SAFETY: `self.0` is a valid job handle and `proc.0` is a live process handle.
            let assigned = unsafe { AssignProcessToJobObject(self.0, proc.0) };
            if assigned == 0 {
                // SAFETY: `GetLastError` reads the calling thread's last-error code.
                let code = unsafe { GetLastError() };
                return Err(format!(
                    "AssignProcessToJobObject({pid}) failed with Win32 error {code}"
                ));
            }
            Ok(())
        }

        pub(crate) fn terminate(&self) {
            if !self.0.is_null() {
                // SAFETY: `self.0` is a valid job handle owned by this wrapper.
                unsafe {
                    TerminateJobObject(self.0, 1);
                }
            }
        }
    }

    impl Drop for SidecarJobObject {
        fn drop(&mut self) {
            if !self.0.is_null() {
                // SAFETY: `self.0` was created by `CreateJobObjectW` and is closed once on drop.
                unsafe {
                    CloseHandle(self.0);
                }
            }
        }
    }
}

#[cfg(not(windows))]
mod platform {
    #[derive(Debug)]
    pub(crate) struct SidecarJobObject;

    impl SidecarJobObject {
        pub(crate) fn create() -> Result<Self, String> {
            Ok(Self)
        }

        pub(crate) fn assign_pid(&self, _pid: u32) -> Result<(), String> {
            Ok(())
        }

        pub(crate) fn terminate(&self) {}
    }
}

pub(crate) use platform::SidecarJobObject;

#[cfg(all(test, windows))]
mod tests {
    use std::{
        os::windows::process::CommandExt,
        process::{Command, Stdio},
        time::{Duration, Instant},
    };

    use super::SidecarJobObject;

    #[test]
    fn dropping_job_object_terminates_assigned_process() {
        let mut child = Command::new("cmd")
            .args(["/C", "ping -n 30 127.0.0.1 >nul"])
            .creation_flags(0x0800_0000)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("spawn child process");

        let job = SidecarJobObject::create().expect("create job object");
        job.assign_pid(child.id()).expect("assign pid to job");
        drop(job);

        let deadline = Instant::now() + Duration::from_secs(2);
        let exited = loop {
            if let Ok(Some(_)) = child.try_wait() {
                break true;
            }
            if Instant::now() >= deadline {
                let _ = child.kill();
                let _ = child.wait();
                break false;
            }
            std::thread::sleep(Duration::from_millis(25));
        };
        assert!(exited, "child process survived job handle drop");
    }
}
