#!/usr/bin/env python3
"""
使用 DALL·E 2 的 images.edit 接口，基于梨花幼苗图（单张）生成 4 个中间阶段。
提示词从外部 JSON 加载，松耦合。图片处理返回 BytesIO 对象以满足 SDK 要求。
"""

import base64
import json
import os
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image
from openai import OpenAI

# ========================= 可调配置 =========================
SEEDLING_IMAGE = "seedling.png"      # 参考图：梨花幼苗（唯一输入图）
PROMPTS_FILE = "prompts.json"        # 提示词文件
OUTPUT_BASE = "output"               # 输出根目录
IMAGE_SIZE = (1024, 1024)            # 必须正方形
MODEL = "dall-e-2"                   # DALL·E 2 编辑接口
PREPROCESS_IMAGES = True             # 是否居中裁剪为正方形再缩放

# ========================= 工具函数 =========================
def load_config(file_path: str) -> dict:
    """读取 JSON 配置文件，返回 prompts 列表"""
    with open(file_path, "r", encoding="utf-8") as f:
        config = json.load(f)
    prompts = config.get("prompts", [])
    if len(prompts) != 4:
        sys.exit(f"prompts 必须包含 4 条语句，实际: {len(prompts)}")
    return {"prompts": prompts}

def preprocess_image(image_path: str, size: tuple) -> BytesIO:
    """
    将图片居中裁剪为正方形，缩放到指定尺寸，返回 BytesIO 对象（PNG）。
    若 PREPROCESS_IMAGES=False 则直接返回原图文件对象。
    """
    if not PREPROCESS_IMAGES:
        return open(image_path, "rb")

    img = Image.open(image_path).convert("RGB")
    w, h = img.size
    min_side = min(w, h)
    left = (w - min_side) // 2
    top = (h - min_side) // 2
    img = img.crop((left, top, left + min_side, top + min_side))
    img = img.resize(size, Image.LANCZOS)

    buf = BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)                     # 重置指针到开头
    return buf

def create_transparent_mask(size: tuple) -> BytesIO:
    """创建全透明 RGBA PNG 遮罩（BytesIO 对象），表示全图可编辑"""
    mask = Image.new("RGBA", size, (0, 0, 0, 0))
    buf = BytesIO()
    mask.save(buf, format="PNG")
    buf.seek(0)
    return buf

def build_prompt(stage_prompt: str) -> str:
    """直接返回原始提示词，脚本不添加额外内容"""
    return stage_prompt

# ========================= 主流程 =========================
def main():
    if not os.getenv("OPENAI_API_KEY"):
        sys.exit("错误：请设置环境变量 OPENAI_API_KEY")

    client = OpenAI()
    prompts = load_config(PROMPTS_FILE)["prompts"]

    # 获取参考图与遮罩的文件对象（每次调用前需 seek(0) 以重用）
    seedling_file = preprocess_image(SEEDLING_IMAGE, IMAGE_SIZE)
    mask_file = create_transparent_mask(IMAGE_SIZE)

    for idx, stage_prompt in enumerate(prompts, start=2):
        full_prompt = build_prompt(stage_prompt)
        print(f"\n--- 正在生成 lihua_image{idx} ---")
        print(f"Prompt: {full_prompt[:200]}...")

        # 确保文件指针在开头（因为循环会多次使用同一个文件对象）
        seedling_file.seek(0)
        mask_file.seek(0)

        response = client.images.edit(
            model=MODEL,
            image=seedling_file,          # 类文件对象
            mask=mask_file,               # 类文件对象
            prompt=full_prompt,
            size=f"{IMAGE_SIZE[0]}x{IMAGE_SIZE[1]}",
            n=1,
            response_format="b64_json"
        )

        b64_data = response.data[0].b64_json
        if not b64_data:
            raise RuntimeError("API 未返回 b64_json 数据")

        image_bytes = base64.b64decode(b64_data)

        output_dir = Path(OUTPUT_BASE) / f"lihua_image{idx}"
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / "result.png"
        with open(output_path, "wb") as f:
            f.write(image_bytes)

        print(f"已保存：{output_path}")

    print("\n✅ 全部 4 个阶段生成完成！")

if __name__ == "__main__":
    main()