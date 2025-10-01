import os
import shutil
from datetime import datetime

# --- Configuration ---
SOURCE_FILE = 'prompt_manager.db'
BACKUP_DIR = 'backup_db'
# -------------------

def backup_database():
    """
    Backs up the database file to a timestamped file in the backup directory.
    """
    # Get the directory where the script is located to build absolute paths
    base_dir = os.path.dirname(os.path.abspath(__file__))
    source_path = os.path.join(base_dir, SOURCE_FILE)
    backup_path = os.path.join(base_dir, BACKUP_DIR)

    # Ensure the source file exists
    if not os.path.exists(source_path):
        print(f"Error: Source database file not found at '{source_path}'")
        return

    # Ensure the backup directory exists
    try:
        os.makedirs(backup_path, exist_ok=True)
    except OSError as e:
        print(f"Error: Could not create backup directory '{backup_path}'. Reason: {e}")
        return

    # Generate the timestamped filename
    timestamp = datetime.now().strftime('%Y-%m-%d_%H_%M_%S')
    backup_filename = f"{timestamp}_{SOURCE_FILE}"
    destination_path = os.path.join(backup_path, backup_filename)

    # Copy the file
    try:
        shutil.copy(source_path, destination_path)
        print(f"Successfully backed up to '{destination_path}'")
    except IOError as e:
        print(f"Error: Could not copy file. Reason: {e}")

if __name__ == '__main__':
    backup_database()
