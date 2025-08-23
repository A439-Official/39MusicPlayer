import pygame
import pygame.draw
import pygame.gfxdraw


def aa_rounded_rect(surface, rect, color, radius, alpha=255, border=0, border_color=None):
    x, y, width, height = rect
    radius = min(radius, min(width, height) // 2)
    if radius < 0:
        radius = 0
    temp_surface = pygame.Surface((width, height), pygame.SRCALPHA)
    border_color = border_color if border_color else color
    if alpha > 0:
        for aa in [True, False] if radius > 0 else []:
            for corner_x, corner_y in [(0, 0), (1, 0), (0, 1), (1, 1)]:
                circle_x = width * corner_x - radius * (corner_x * 2 - 1)
                circle_y = height * corner_y - radius * (corner_y * 2 - 1)
                if aa:
                    pygame.gfxdraw.aacircle(temp_surface, int(circle_x) - (1 - corner_x), int(circle_y) - (1 - corner_y), radius - 1, color)
                else:
                    pygame.draw.circle(temp_surface, (*color, alpha), (int(circle_x), int(circle_y)), radius)
        pygame.draw.rect(temp_surface, (*color, alpha), (0, radius, width, height - 2 * radius))
        pygame.draw.rect(temp_surface, (*color, alpha), (radius, 0, width - 2 * radius, height))
    surface.blit(temp_surface, (x, y))


def ring(surface, center, radius, width, color=(255, 255, 255)):
    temp_surface = pygame.Surface((radius * 2, radius * 2), pygame.SRCALPHA)
    pygame.draw.circle(temp_surface, color, (radius, radius), radius)
    inner_radius = radius - width
    if inner_radius > 0:
        pygame.draw.circle(temp_surface, (0, 0, 0, 0), (radius, radius), inner_radius)
    surface.blit(temp_surface, (center[0] - radius, center[1] - radius))


def text(font, text, color, align=0.5, min_width=0):
    """
    渲染文本，支持自动换行和文本对齐

    参数:
    font: 字体对象或字体名称字符串
    text: 要渲染的文本内容
    color: 文本颜色
    align: 文本对齐方式 (0=左对齐, 0.5=居中, 1=右对齐)
    min_width: 最小宽度，超过此宽度将自动换行

    返回:
    pygame.Surface: 渲染后的文本表面
    """
    # 处理字体参数
    if isinstance(font, str):
        font = pygame.font.SysFont(font, 24)

    # 如果不需要换行，直接渲染
    if min_width <= 0:
        return font.render(text, True, color)

    # 确定分隔符和连接符
    has_spaces = " " in text
    separator = " " if has_spaces else ""
    joiner = "" if has_spaces else "-"

    # 分割文本为单词或字符
    parts = text.split(separator) if has_spaces else list(text)

    # 构建行
    lines = []
    current_line = []

    for part in parts:
        # 测试添加当前部分后的行宽度
        test_line = separator.join(current_line + [part])
        if not has_spaces and current_line:
            test_line += joiner

        # 检查是否需要换行
        if font.size(test_line)[0] > min_width and current_line:
            line_text = separator.join(current_line)
            if not has_spaces and len(current_line) > 1:
                line_text += joiner
            lines.append(line_text)
            current_line = [part]
        else:
            current_line.append(part)

    # 添加最后一行
    if current_line:
        line_text = separator.join(current_line)
        lines.append(line_text)

    # 渲染每一行
    rendered_lines = []
    max_width = 0
    total_height = 0

    for line in lines:
        rendered_line = font.render(line, True, color)
        rendered_lines.append(rendered_line)
        max_width = max(max_width, rendered_line.get_width())
        total_height += rendered_line.get_height()

    # 创建最终表面并绘制所有行
    final_surface = pygame.Surface((max_width, total_height), pygame.SRCALPHA)
    y = 0

    for line_surface in rendered_lines:
        x = (max_width - line_surface.get_width()) * align
        final_surface.blit(line_surface, (x, y))
        y += line_surface.get_height()

    return final_surface
