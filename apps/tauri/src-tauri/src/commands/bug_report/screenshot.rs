use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

use super::types::{MAX_SCREENSHOT_BYTES, MIN_SCREENSHOT_EDGE, RawImage};

pub(super) fn capture_screen_data_url() -> Result<Option<String>, String> {
    let Some(image) = screen_capture::capture_virtual_screen()? else {
        return Ok(None);
    };
    let png = encode_screenshot_within_limit(image)?;
    Ok(Some(format!(
        "data:image/png;base64,{}",
        BASE64.encode(png)
    )))
}

fn encode_screenshot_within_limit(mut image: RawImage) -> Result<Vec<u8>, String> {
    loop {
        let png = encode_png(&image)?;
        let can_shrink =
            image.width / 2 >= MIN_SCREENSHOT_EDGE && image.height / 2 >= MIN_SCREENSHOT_EDGE;
        if png.len() <= MAX_SCREENSHOT_BYTES || !can_shrink {
            return Ok(png);
        }
        image = image.downsample_half();
    }
}

pub(super) fn encode_png(image: &RawImage) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::with_capacity(image.rgba.len() / 4);
    let mut encoder = png::Encoder::new(&mut bytes, image.width, image.height);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    let mut writer = encoder.write_header().map_err(|error| error.to_string())?;
    writer
        .write_image_data(&image.rgba)
        .map_err(|error| error.to_string())?;
    writer.finish().map_err(|error| error.to_string())?;
    Ok(bytes)
}

impl RawImage {
    pub(super) fn downsample_half(&self) -> Self {
        let src_width = self.width as usize;
        let src_stride = src_width * 4;
        let width = self.width / 2;
        let height = self.height / 2;
        let mut rgba = Vec::with_capacity(width as usize * height as usize * 4);

        for y in 0..height as usize {
            let top = &self.rgba[y * 2 * src_stride..(y * 2 + 1) * src_stride];
            let bottom = &self.rgba[(y * 2 + 1) * src_stride..(y * 2 + 2) * src_stride];
            for x in 0..width as usize {
                let left = x * 8;
                let right = left + 4;
                for channel in 0..4 {
                    let sum = u16::from(top[left + channel])
                        + u16::from(top[right + channel])
                        + u16::from(bottom[left + channel])
                        + u16::from(bottom[right + channel]);
                    rgba.push(u8::try_from(sum / 4).unwrap_or(u8::MAX));
                }
            }
        }

        Self {
            width,
            height,
            rgba,
        }
    }
}

#[cfg(not(windows))]
mod screen_capture {
    use super::RawImage;

    pub(super) fn capture_virtual_screen() -> Result<Option<RawImage>, String> {
        Ok(None)
    }
}

#[cfg(windows)]
mod screen_capture {
    use std::mem;

    use windows_sys::Win32::{
        Graphics::Gdi::{
            BI_RGB, BITMAPINFO, BITMAPINFOHEADER, BitBlt, CAPTUREBLT, CreateCompatibleBitmap,
            CreateCompatibleDC, DIB_RGB_COLORS, DeleteDC, DeleteObject, GetDIBits, HBITMAP, HDC,
            HGDIOBJ, SRCCOPY, SelectObject,
        },
        UI::WindowsAndMessaging::{
            GetSystemMetrics, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN,
            SM_YVIRTUALSCREEN,
        },
    };

    use super::RawImage;
    use crate::win32::ScreenDc;

    const MAX_CAPTURE_BYTES: usize = 512 * 1024 * 1024;

    struct MemoryDc(HDC);

    impl MemoryDc {
        fn compatible_with(screen: &ScreenDc) -> Result<Self, String> {
            // SAFETY: `screen.handle()` is a live DC for the lifetime of `screen`.
            let dc = unsafe { CreateCompatibleDC(screen.handle()) };
            if dc.is_null() {
                return Err("Failed to create the capture context.".to_owned());
            }
            Ok(Self(dc))
        }
    }

    impl Drop for MemoryDc {
        fn drop(&mut self) {
            // SAFETY: `self.0` was created by `CreateCompatibleDC` and is owned by us.
            unsafe {
                DeleteDC(self.0);
            }
        }
    }

    struct GdiBitmap(HBITMAP);

    impl GdiBitmap {
        fn compatible_with(screen: &ScreenDc, width: i32, height: i32) -> Result<Self, String> {
            // SAFETY: `screen.handle()` is a live DC; dimensions were validated as positive.
            let bitmap = unsafe { CreateCompatibleBitmap(screen.handle(), width, height) };
            if bitmap.is_null() {
                return Err("Failed to create the capture bitmap.".to_owned());
            }
            Ok(Self(bitmap))
        }
    }

    impl Drop for GdiBitmap {
        fn drop(&mut self) {
            // SAFETY: `self.0` was created by `CreateCompatibleBitmap` and is owned by us.
            unsafe {
                DeleteObject(self.0);
            }
        }
    }

    struct Selection<'a> {
        dc: &'a MemoryDc,
        _bitmap: &'a GdiBitmap,
        previous: HGDIOBJ,
    }

    impl<'a> Selection<'a> {
        fn select(dc: &'a MemoryDc, bitmap: &'a GdiBitmap) -> Self {
            // SAFETY: both handles are live for `'a`.
            let previous = unsafe { SelectObject(dc.0, bitmap.0) };
            Self {
                dc,
                _bitmap: bitmap,
                previous,
            }
        }
    }

    impl Drop for Selection<'_> {
        fn drop(&mut self) {
            // SAFETY: restores the object that was selected before us into a live DC.
            unsafe {
                SelectObject(self.dc.0, self.previous);
            }
        }
    }

    pub(super) fn capture_virtual_screen() -> Result<Option<RawImage>, String> {
        // SAFETY: `GetSystemMetrics` has no preconditions.
        let (left, top, width, height) = unsafe {
            (
                GetSystemMetrics(SM_XVIRTUALSCREEN),
                GetSystemMetrics(SM_YVIRTUALSCREEN),
                GetSystemMetrics(SM_CXVIRTUALSCREEN),
                GetSystemMetrics(SM_CYVIRTUALSCREEN),
            )
        };
        if width <= 0 || height <= 0 {
            return Ok(None);
        }
        let width_px = u32::try_from(width).map_err(|error| error.to_string())?;
        let height_px = u32::try_from(height).map_err(|error| error.to_string())?;
        let byte_len = (width_px as usize)
            .checked_mul(height_px as usize)
            .and_then(|pixels| pixels.checked_mul(4))
            .filter(|len| *len <= MAX_CAPTURE_BYTES)
            .ok_or_else(|| "The virtual screen is too large to capture.".to_owned())?;

        let screen =
            ScreenDc::acquire().ok_or_else(|| "Failed to access the screen context.".to_owned())?;
        let memory = MemoryDc::compatible_with(&screen)?;
        let bitmap = GdiBitmap::compatible_with(&screen, width, height)?;

        {
            let selection = Selection::select(&memory, &bitmap);
            // SAFETY: source/destination DCs and the selected bitmap are all live;
            // the rectangle lies within the bitmap created with the same size.
            let copied = unsafe {
                BitBlt(
                    selection.dc.0,
                    0,
                    0,
                    width,
                    height,
                    screen.handle(),
                    left,
                    top,
                    SRCCOPY | CAPTUREBLT,
                )
            };
            if copied == 0 {
                return Err("Failed to copy pixels from the screen.".to_owned());
            }
        }

        // SAFETY: `BITMAPINFO` is plain-old-data; all-zero is a valid initial state.
        let mut info: BITMAPINFO = unsafe { mem::zeroed() };
        info.bmiHeader = BITMAPINFOHEADER {
            biSize: mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: width,
            biHeight: -height,
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB,
            biSizeImage: 0,
            biXPelsPerMeter: 0,
            biYPelsPerMeter: 0,
            biClrUsed: 0,
            biClrImportant: 0,
        };

        let mut pixels = vec![0u8; byte_len];
        // SAFETY: `pixels` holds exactly width*height*4 bytes, matching the 32-bpp
        // top-down DIB described by `info`; the bitmap is not selected into any DC.
        let rows = unsafe {
            GetDIBits(
                memory.0,
                bitmap.0,
                0,
                height_px,
                pixels.as_mut_ptr().cast(),
                &mut info,
                DIB_RGB_COLORS,
            )
        };
        if rows == 0 {
            return Err("Failed to read pixels from the screen.".to_owned());
        }

        for pixel in pixels.chunks_exact_mut(4) {
            pixel.swap(0, 2);
            pixel[3] = 0xFF;
        }

        Ok(Some(RawImage {
            width: width_px,
            height: height_px,
            rgba: pixels,
        }))
    }
}
