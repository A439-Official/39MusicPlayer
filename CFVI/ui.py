import pygame


class UIManager:
    def __init__(self):
        self.ui_list = {}

    def event(self, event: pygame.event.Event):
        for ui in self.ui_list:
            self.ui_list[ui].event(event)

    def draw(self, surface: pygame.Surface):
        for ui in self.ui_list:
            self.ui_list[ui].draw(surface)

    def __setitem__(self, key: str, value: object):
        self.ui_list[key] = value

    def __getitem__(self, key: str):
        return self.ui_list[key]


class Button:
    def __init__(
        self,
        x: int = 0,
        y: int = 0,
        width: int = 100,
        height: int = 100,
        texture: pygame.Surface = None,
        onClick: callable = None,
    ):

        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.texture = texture
        self.onClick = onClick
        self.hovered: bool = False
        self.clicked: bool = False

    def event(self, event: pygame.event.Event):
        if event.type in (
            pygame.MOUSEMOTION,
            pygame.MOUSEBUTTONDOWN,
            pygame.MOUSEBUTTONUP,
        ):
            self.hovered = _in_rect(
                event.pos, (self.x, self.y, self.width, self.height)
            )
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1 and self.hovered:
            self.clicked = True
        elif (
            event.type == pygame.MOUSEBUTTONUP
            and event.button == 1
            and self.clicked
            and self.hovered
        ):
            self.onClick and self.onClick()
            self.clicked = False

    def draw(self, surface: pygame.Surface):
        if self.texture:
            surface.blit(self.texture, (self.x, self.y))
        elif self.hovered:
            pygame.draw.rect(
                surface, (255, 255, 255), (self.x, self.y, self.width, self.height), 2
            )
        else:
            pygame.draw.rect(
                surface, (255, 255, 255), (self.x, self.y, self.width, self.height)
            )


def _in_rect(pos: tuple[int, int], rect: tuple):
    return (
        pos[0] >= rect[0]
        and pos[0] <= rect[0] + rect[2]
        and pos[1] >= rect[1]
        and pos[1] <= rect[1] + rect[3]
    )
