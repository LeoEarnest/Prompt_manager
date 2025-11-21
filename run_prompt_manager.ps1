
# 1. 直接进入项目文件夹
Set-Location "D:\BSC\Technology_Apartment\PDL-Git\AGI\prompt_manager"

# 2. 使用绝对路径激活 venv 虚拟环境
. "D:\BSC\Technology_Apartment\PDL-Git\AGI\prompt_manager\env_pm\Scripts\Activate.ps1"

# 3. 启动一个后台任务，在2秒后打开浏览器
Start-Job { Start-Sleep 2; Start-Process chrome 'http://127.0.0.1:5000/' } | Out-Null

# 4. 运行 Python 主程序
python .\run.py