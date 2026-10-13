use std::ptr;

use windows_sys::Win32::Graphics::Gdi::{GetDC, HDC, ReleaseDC};

pub(crate) struct ScreenDc(HDC);

impl ScreenDc {
    pub(crate) fn acquire() -> Option<Self> {
        // SAFETY: `GetDC(null)` takes no borrowed state and returns either a
        // live DC or null; nothing is dereferenced here.
        let dc = unsafe { GetDC(ptr::null_mut()) };
        (!dc.is_null()).then_some(Self(dc))
    }

    pub(crate) fn handle(&self) -> HDC {
        self.0
    }
}

impl Drop for ScreenDc {
    fn drop(&mut self) {
        // SAFETY: `self.0` came from `GetDC(null)` in `acquire`, is released
        // here only, and `ScreenDc` is never copied (`HDC` is a raw pointer
        // behind a private field with no `Clone`).
        unsafe {
            ReleaseDC(ptr::null_mut(), self.0);
        }
    }
}
