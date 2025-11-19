@echo off
echo 正在启动微信开发者工具...
echo 项目路径: %~dp0
echo.

REM 检查微信开发者工具是否存在
if exist "C:\Program Files (x86)\Tencent\微信web开发者工具\wechatdevtools.exe" (
    echo 找到微信开发者工具
    echo 正在启动项目...
    echo.
    
    REM 启动微信开发者工具并打开当前项目
    start "" "C:\Program Files (x86)\Tencent\微信web开发者工具\wechatdevtools.exe" "--project-path=%~dp0"
    
    echo 微信开发者工具已启动
    echo 项目已加载，请在工具中查看运行效果
) else (
    echo 错误：未找到微信开发者工具
    echo 请确保已安装微信开发者工具
    echo 下载地址：https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html
)

echo.
echo 按任意键退出...
pause >nul