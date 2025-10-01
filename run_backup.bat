@echo off
REM This batch file activates the local venv and runs the Python backup script.

REM Check if the virtual environment activation script exists
IF NOT EXIST "env_pm\Scripts\activate.bat" (
    echo Error: Virtual environment not found in 'env_pm' directory.
    echo Please ensure the project's virtual environment is set up correctly.
    pause
    exit /b
)

echo Activating virtual environment...
call "env_pm\Scripts\activate.bat"

echo.
echo Running database backup...
python backup.py
echo.

echo Backup process finished.
pause