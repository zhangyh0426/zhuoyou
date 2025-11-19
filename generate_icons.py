#!/usr/bin/env python3
"""
生成微信小程序tabBar所需的图标文件
"""

import os
from PIL import Image, ImageDraw, ImageFont

# 图标参数
ICON_SIZE = (81, 81)  # 推荐尺寸：81px * 81px
BG_COLOR = (255, 255, 255, 0)  # 透明背景 (RGBA格式)
ICON_COLOR = (51, 51, 51, 255)  # 默认图标颜色 (RGBA格式)
ACTIVE_ICON_COLOR = (0, 122, 255, 255)  # 激活状态图标颜色 (RGBA格式)

def create_icon(icon_path, shape, color):
    """创建单个图标"""
    # 创建一个透明的图像
    img = Image.new('RGBA', ICON_SIZE, BG_COLOR)
    draw = ImageDraw.Draw(img)
    
    # 根据形状类型绘制图标
    if shape == "home":
        # 绘制房子形状
        # 屋顶
        draw.polygon([(40, 15), (15, 40), (65, 40)], fill=color)
        # 房子主体
        draw.rectangle([20, 40, 60, 65], fill=color)
        # 门
        draw.rectangle([37, 50, 43, 65], fill=BG_COLOR)
        
    elif shape == "home-active":
        # 绘制激活状态的房子形状
        # 屋顶
        draw.polygon([(40, 15), (15, 40), (65, 40)], fill=ACTIVE_ICON_COLOR)
        # 房子主体
        draw.rectangle([20, 40, 60, 65], fill=ACTIVE_ICON_COLOR)
        # 门
        draw.rectangle([37, 50, 43, 65], fill=BG_COLOR)
        # 添加一个圆形表示活跃状态
        draw.ellipse([58, 58, 68, 68], fill=(255, 165, 0, 255))
        
    elif shape == "member":
        # 绘制会员卡形状
        # 卡主体
        draw.rounded_rectangle([15, 25, 65, 55], radius=5, fill=color)
        # 卡号线
        draw.line([20, 35, 60, 35], fill=BG_COLOR, width=2)
        draw.line([20, 42, 60, 42], fill=BG_COLOR, width=2)
        
    elif shape == "member-active":
        # 绘制激活状态的会员卡形状
        # 卡主体
        draw.rounded_rectangle([15, 25, 65, 55], radius=5, fill=ACTIVE_ICON_COLOR)
        # 卡号线
        draw.line([20, 35, 60, 35], fill=BG_COLOR, width=2)
        draw.line([20, 42, 60, 42], fill=BG_COLOR, width=2)
        # 添加一个星形表示激活状态
        draw.polygon([(60, 30), (62, 35), (67, 35), (63, 38), (65, 43), (60, 40), (55, 43), (57, 38), (53, 35), (58, 35)], fill=(255, 165, 0, 255))
        
    elif shape == "activity":
        # 绘制活动形状（日历）
        # 日历主体
        draw.rounded_rectangle([20, 20, 60, 60], radius=5, fill=color)
        # 日历顶部
        draw.rectangle([20, 20, 60, 30], fill=color)
        # 日历环
        draw.ellipse([35, 15, 45, 25], fill=color)
        draw.ellipse([55, 15, 65, 25], fill=color)
        # 日期数字
        draw.text((35, 38), "15", fill=BG_COLOR)
        
    elif shape == "activity-active":
        # 绘制激活状态的活动形状（日历）
        # 日历主体
        draw.rounded_rectangle([20, 20, 60, 60], radius=5, fill=ACTIVE_ICON_COLOR)
        # 日历顶部
        draw.rectangle([20, 20, 60, 30], fill=ACTIVE_ICON_COLOR)
        # 日历环
        draw.ellipse([35, 15, 45, 25], fill=ACTIVE_ICON_COLOR)
        draw.ellipse([55, 15, 65, 25], fill=ACTIVE_ICON_COLOR)
        # 日期数字
        draw.text((35, 38), "15", fill=BG_COLOR)
        # 添加一个星形表示激活状态
        draw.polygon([(60, 30), (62, 35), (67, 35), (63, 38), (65, 43), (60, 40), (55, 43), (57, 38), (53, 35), (58, 35)], fill=(255, 165, 0, 255))
    
    # 保存图像
    img.save(icon_path, "PNG")
    print(f"已生成图标: {icon_path}")

def main():
    """主函数：生成所有图标"""
    # 确保图标目录存在
    icon_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "images")
    os.makedirs(icon_dir, exist_ok=True)
    
    # 图标文件列表
    icons = [
        ("home.png", "home", ICON_COLOR),
        ("home-active.png", "home-active", ACTIVE_ICON_COLOR),
        ("member.png", "member", ICON_COLOR),
        ("member-active.png", "member-active", ACTIVE_ICON_COLOR),
        ("activity.png", "activity", ICON_COLOR),
        ("activity-active.png", "activity-active", ACTIVE_ICON_COLOR)
    ]
    
    # 生成每个图标
    for filename, shape, color in icons:
        icon_path = os.path.join(icon_dir, filename)
        create_icon(icon_path, shape, color)
    
    print("\n所有图标生成完成！")
    print(f"图标保存位置: {icon_dir}")

if __name__ == "__main__":
    main()