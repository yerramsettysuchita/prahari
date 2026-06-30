"""Delete every document in the Firestore `cases` collection.

Use this to reset the board (for example to remove demo seed data) before
filling it with real reports. Destructive and intentional.

    python clear_cases.py
"""

from __future__ import annotations

import load_env  # noqa: F401  loads backend/.env

from firebase import get_db


def main() -> None:
    db = get_db()
    if db is None:
        print("Firestore is not configured. Nothing was deleted.")
        return

    deleted = 0
    while True:
        batch = db.batch()
        docs = list(db.collection("cases").limit(400).stream())
        if not docs:
            break
        for d in docs:
            batch.delete(d.reference)
        batch.commit()
        deleted += len(docs)

    print(f"Deleted {deleted} cases. The board is now empty.")


if __name__ == "__main__":
    main()
