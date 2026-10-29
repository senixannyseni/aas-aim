"""Offline contract tests: NOT substitutes for a mounted Chromium audit."""
import unittest
from browser_audit_matrix import CANONICAL_COUNT, VIEWPORT_WIDTHS, load_canonical_rows, responsive_matrix


class ResponsiveAuditMatrixTests(unittest.TestCase):
    def test_canonical_rows_are_unique_and_nonempty(self):
        rows = load_canonical_rows()
        self.assertEqual(len(rows), CANONICAL_COUNT)
        self.assertEqual(len({screen_id for screen_id, _ in rows}), CANONICAL_COUNT)
        self.assertTrue(all(title.strip() for _, title in rows))

    def test_full_matrix_is_78_screens_times_four_viewports(self):
        matrix = list(responsive_matrix(load_canonical_rows()))
        self.assertEqual(len(matrix), 312)
        self.assertEqual(len(set(matrix)), 312)
        self.assertEqual({width for width, _, _ in matrix}, set(VIEWPORT_WIDTHS))
        self.assertTrue(all(sum(1 for w, _, _ in matrix if w == width) == 78 for width in VIEWPORT_WIDTHS))

    def test_invalid_viewports_fail_before_launch(self):
        rows = load_canonical_rows()
        with self.assertRaisesRegex(ValueError, "distinct positive"):
            list(responsive_matrix(rows, (375, 375)))
        with self.assertRaisesRegex(ValueError, "distinct positive"):
            list(responsive_matrix(rows, (0, 375)))


if __name__ == "__main__":
    unittest.main()
