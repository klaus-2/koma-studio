from __future__ import annotations

from pathlib import Path
import sys
import unittest
from unittest.mock import patch


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from core import hf_download


class ResolveHfFileTests(unittest.TestCase):
    def test_resolve_hf_file_matches_case_insensitive_sibling_path(self) -> None:
        siblings = [
            {
                "rfilename": "Hunyuan-MT-7B-q4_k_m.gguf",
                "lfs": {"sha256": "a" * 64},
            }
        ]

        with patch.object(hf_download, "fetch_hf_siblings", return_value=siblings):
            selected_path, resolved_sha, download_url = hf_download.resolve_hf_file(
                repo="Mungert/Hunyuan-MT-7B-GGUF",
                candidate_paths=["Hunyuan-MT-7B-Q4_K_M.gguf"],
            )

        self.assertEqual(selected_path, "Hunyuan-MT-7B-q4_k_m.gguf")
        self.assertEqual(resolved_sha, "a" * 64)
        self.assertEqual(
            download_url,
            "https://huggingface.co/Mungert/Hunyuan-MT-7B-GGUF/resolve/main/Hunyuan-MT-7B-q4_k_m.gguf",
        )


if __name__ == "__main__":
    unittest.main()
