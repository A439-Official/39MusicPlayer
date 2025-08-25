import pygame
import CFVI.music
import CFVI.draw
import imgui
import imgui.integrations.pygame
import OpenGL.GL
import os
import json
import requests
import threading
import soundfile
import numpy
import sys
import moviepy


def resource_path(relative_path):
    try:
        base_path = sys._MEIPASS
    except AttributeError:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)


NAME = "39MusicPlayer"
CREATOR = "A439"
VERSION = "0.1.2"
STATES = {}
LOCK = threading.Lock()
LANGUAGES = json.load(open(resource_path("./resources/languages.json"), "r", encoding="utf-8"))


def lang(text):
    lang = (["en"] + [lang for lang in LANGUAGES])[STATES["settings"].get("language", 0)]
    return LANGUAGES[lang].get(text, text) if lang in LANGUAGES else text


class DownloadThread(threading.Thread):
    def __init__(self, song_id):
        super().__init__()
        self.song_id = song_id
        self.daemon = True

    def run(self):
        with LOCK:
            STATES["download_status"][self.song_id] = "Downloading"
        try:
            path = f"{STATES['songs_path']}\\{self.song_id}"
            song_info = CFVI.music.api.info(self.song_id)
            if song_info["privilege"]["pl"] < 0:
                with LOCK:
                    STATES["download_status"][self.song_id] = "No permission"
                return
            song = CFVI.music.api.song(self.song_id)
            song_data = requests.get(song["url"]).content
            song.pop("url")
            pic_url = song_info["pic"]
            pic_data = requests.get(pic_url).content
            song_info.pop("pic")
            song_info["data"] = song
            lyrics = CFVI.music.api.lyric(self.song_id)
            if lyrics:
                song_info["lyrics"] = lyrics["lyrics"]
            mv = CFVI.music.api.mv(song_info["mv"]) if song_info.get("mv") else None
            if mv:
                song_info["mv"] = mv["url"]
            mv_data = requests.get(mv["url"]).content if mv else None
            if not os.path.exists(path):
                os.makedirs(path)
            with open(f"{path}\\info.json", "w", encoding="utf-8") as f:
                f.write(json.dumps(song_info))
            with open(f"{path}\\song.mp3", "wb") as f:
                f.write(song_data)
            with open(f"{path}\\pic.jpg", "wb") as f:
                f.write(pic_data)
            if mv_data:
                with open(f"{path}\\mv.mp4", "wb") as f:
                    f.write(mv_data)
            with LOCK:
                STATES["song_list"][self.song_id] = song_info
                STATES["download_status"][self.song_id] = "Completed"
                if self.song_id in STATES["download_queue"]:
                    STATES["download_queue"].remove(self.song_id)
        except Exception as e:
            with LOCK:
                STATES["download_status"][self.song_id] = f"Error: {str(e)}"
            print(f"Failed to download song: {e}")


def setup_opengl(screen):
    texture_id = OpenGL.GL.glGenTextures(1)
    OpenGL.GL.glBindTexture(OpenGL.GL.GL_TEXTURE_2D, texture_id)
    OpenGL.GL.glTexParameteri(OpenGL.GL.GL_TEXTURE_2D, OpenGL.GL.GL_TEXTURE_MIN_FILTER, OpenGL.GL.GL_NEAREST)
    OpenGL.GL.glTexParameteri(OpenGL.GL.GL_TEXTURE_2D, OpenGL.GL.GL_TEXTURE_MAG_FILTER, OpenGL.GL.GL_NEAREST)
    OpenGL.GL.glEnable(OpenGL.GL.GL_TEXTURE_2D)
    return texture_id


def setup_imgui(screen):
    imgui.create_context()
    impl = imgui.integrations.pygame.PygameRenderer()
    io = imgui.get_io()
    io.display_size = screen.get_size()
    font = io.fonts.add_font_from_file_ttf(resource_path("./resources/unifont-16.0.04.otf"), 16, None, io.fonts.get_glyph_ranges_chinese_full())
    impl.refresh_font_texture()
    return impl, font


def render_loop(_screen, screen, texture_id, impl):
    OpenGL.GL.glBindTexture(OpenGL.GL.GL_TEXTURE_2D, texture_id)
    OpenGL.GL.glTexImage2D(OpenGL.GL.GL_TEXTURE_2D, 0, OpenGL.GL.GL_RGBA, _screen.get_width(), _screen.get_height(), 0, OpenGL.GL.GL_RGBA, OpenGL.GL.GL_UNSIGNED_BYTE, pygame.image.tostring(screen, "RGBA", True))
    OpenGL.GL.glClear(OpenGL.GL.GL_COLOR_BUFFER_BIT | OpenGL.GL.GL_DEPTH_BUFFER_BIT)
    OpenGL.GL.glBegin(OpenGL.GL.GL_QUADS)
    for a, b in [((0, 0), (-1, -1)), ((1, 0), (1, -1)), ((1, 1), (1, 1)), ((0, 1), (-1, 1))]:
        OpenGL.GL.glTexCoord2f(a[0], a[1])
        OpenGL.GL.glVertex2f(b[0], b[1])
    OpenGL.GL.glEnd()
    imgui.render()
    impl.render(imgui.get_draw_data())
    pygame.display.flip()


def refresh_song_list():
    if not os.path.exists(STATES["songs_path"]):
        os.makedirs(STATES["songs_path"])
    for song_id in os.listdir(STATES["songs_path"]):
        info_path = f"{STATES['songs_path']}\\{song_id}\\info.json"
        if os.path.exists(info_path):
            STATES["song_list"][song_id] = json.loads(open(info_path, "r", encoding="utf-8").read())


def play_song(song_id):
    print(f"Playing song {song_id}")
    STATES["now_playing"] = song_id
    STATES["song_bg"] = None
    STATES["song_mv"] = None
    song_path = f"{STATES['songs_path']}\\{song_id}\\song.mp3"
    if not pygame.mixer.get_init():
        pygame.mixer.init()
    try:
        pygame.mixer.music.stop()
        pygame.mixer.music.load(song_path)
        pygame.mixer.music.play()
        STATES["is_playing"] = True
    except Exception as e:
        print(f"Failed to play song: {e}")
        STATES["now_playing"] = None
        STATES["is_playing"] = False
    STATES["song_data"], STATES["song_sr"] = soundfile.read(song_path)
    bg_path = f"{STATES['songs_path']}\\{song_id}\\pic.jpg"
    bg = pygame.image.load(bg_path) if os.path.exists(bg_path) else None
    if bg:
        STATES["song_bg"] = pygame.transform.scale(bg, (STATES["screen_size"][1], STATES["screen_size"][1]))
    mv_path = f"{STATES['songs_path']}\\{song_id}\\mv.mp4"
    mv = moviepy.VideoFileClip(mv_path) if STATES["settings"].get("play_mv", False) and os.path.exists(mv_path) else None
    if mv:
        STATES["song_mv"] = mv


def pause_song():
    if STATES.get("is_playing", False):
        pygame.mixer.music.pause()
        STATES["is_playing"] = False
    else:
        pygame.mixer.music.unpause()
        STATES["is_playing"] = True


def play_next_song():
    song_ids = list(STATES["song_list"].keys())
    if STATES["now_playing"] in song_ids:
        current_index = song_ids.index(STATES["now_playing"])
        next_index = (current_index + 1) % len(song_ids)
        play_song(song_ids[next_index])


def play_previous_song():
    song_ids = list(STATES["song_list"].keys())
    if STATES["now_playing"] in song_ids:
        current_index = song_ids.index(STATES["now_playing"])
        previous_index = (current_index - 1) % len(song_ids)
        play_song(song_ids[previous_index])


def cut(lst, i):
    result = []
    for j in range(i - 512, i + 512):
        result.append(lst[j] if 0 <= j < len(lst) else numpy.zeros(lst[0].shape))
    return result


def sigmoid(x):
    return 1 / (1 + numpy.exp(-x))


class SearchThread(threading.Thread):
    def __init__(self, search_text):
        super().__init__()
        self.search_text = search_text
        self.daemon = True

    def run(self):
        try:
            with LOCK:
                STATES["search_status"] = "Searching"
            search_results = CFVI.music.api.search(self.search_text)
            with LOCK:
                STATES["search_results"] = search_results
                STATES["search_status"] = "Completed"
        except Exception as e:
            print(f"Failed to search: {e}")
            with LOCK:
                STATES["search_status"] = f"Error: {str(e)}"
            print(f"Failed to search: {e}")


def start_search():
    if STATES.get("search_text", "").strip():
        STATES["search_status"] = "Searching"
        STATES["search_results"] = []
        search_thread = SearchThread(STATES["search_text"])
        search_thread.start()


def add_to_download_queue(song_id):
    with LOCK:
        if song_id not in STATES["download_queue"]:
            STATES["download_queue"].append(song_id)
            STATES["download_status"][song_id] = "Queued"
            download_thread = DownloadThread(song_id)
            download_thread.start()


def main():
    pygame.init()
    _screen: pygame.Surface = pygame.display.set_mode((1280, 720), pygame.DOUBLEBUF | pygame.OPENGL, vsync=1)
    screen = pygame.Surface(_screen.get_size(), pygame.SRCALPHA)

    texture_id = setup_opengl(_screen)
    impl, imgui_font = setup_imgui(_screen)
    pygame.display.set_caption(f"{NAME} v{VERSION}")
    pygame.display.set_icon(pygame.image.load(resource_path("./resources/39.png")))
    running = True

    # variables
    STATES["screen_size"] = _screen.get_size()
    STATES["songs_path"] = f"{os.environ.get('APPDATA')}\\{CREATOR}\\39MusicPlayer\\song"
    STATES["settings_path"] = f"{os.environ.get('APPDATA')}\\{CREATOR}\\39MusicPlayer\\settings.json"
    STATES["song_list"] = {}
    STATES["download_status"] = {}
    STATES["download_queue"] = []
    STATES["now_playing"] = None
    STATES["is_playing"] = False
    STATES["search_text"] = ""
    STATES["search_results"] = []
    STATES["search_status"] = "Idle"
    STATES["settings"] = json.loads(open(STATES["settings_path"], "r", encoding="utf-8").read()) if os.path.exists(STATES["settings_path"]) else {}
    refresh_song_list()

    # resources
    font = pygame.font.Font(resource_path("./resources/851.ttf"), int(screen.get_height() * 0.0439))

    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False

            impl.process_event(event)

        screen.fill((0, 0, 0, 0))
        if STATES.get("song_bg"):
            screen.blit(STATES["song_bg"], (0, 0))
        if STATES.get("now_playing"):
            STATES["song_data_index"] = int(pygame.mixer.music.get_pos() / 1000 * STATES["song_sr"])
            STATES["song_data_cut"] = numpy.mean(cut(STATES.get("song_data", []), STATES["song_data_index"]), axis=1)
            STATES["song_data_fft"] = numpy.abs(numpy.fft.ihfft(STATES["song_data_cut"]))
            virbo = numpy.var(STATES["song_data_fft"][:15])
            for i in range(screen.get_height()) if virbo > 0.001 else []:
                if 1 + numpy.sin(numpy.tan(i**3 * STATES["song_data_index"])) > 0.25:
                    screen.blit(screen, (int((numpy.sin(numpy.tan(i**2 * STATES["song_data_index"]))) * virbo * screen.get_height() * 4.39), i), (0, i, screen.get_height(), 1))
        if STATES.get("song_mv"):
            frame = pygame.surfarray.make_surface(STATES["song_mv"].get_frame(pygame.mixer.music.get_pos() / 1000).swapaxes(0, 1))
            frame = pygame.transform.scale_by(frame, screen.get_height() / frame.get_width())
            screen.blit(frame, (0, screen.get_height() / 2 - frame.get_height() / 2))
        if STATES.get("now_playing"):
            STATES["rs"] = [numpy.mean(STATES["song_data_fft"][:50])] + STATES.get("rs", [0] * 2)[:-1]
            CFVI.draw.ring(screen, (screen.get_height() / 2, screen.get_height() / 2), screen.get_height() * 0.2 + numpy.mean(STATES["rs"]) * 4.39 * screen.get_height(), screen.get_height() * 0.1, (255, 255, 255, 128))

        poses = [] if len(STATES.get("song_data_fft", [])) else [(0, screen.get_height()), (screen.get_height(), screen.get_height())]
        for i in range(len(STATES.get("song_data_fft", []))):
            x = i / len(STATES["song_data_fft"]) * screen.get_height()
            y = screen.get_height() * (1.5 - sigmoid(numpy.mean(STATES["song_data_fft"][i]) * 43.9))
            poses.append((x, y))
        pygame.draw.lines(screen, (0, 0, 0), False, poses, 2)
        pygame.draw.aalines(screen, (255, 255, 255), False, poses, 1)

        if pygame.mixer.music.get_pos() > 0 and STATES.get("now_playing") and STATES["song_list"].get(STATES["now_playing"], {}).get("lyrics"):
            now_lyric = 0
            last_time = 0
            for i in range(len(STATES["song_list"][STATES["now_playing"]]["lyrics"]) + 1):
                if i < len(STATES["song_list"][STATES["now_playing"]]["lyrics"]):
                    line = STATES["song_list"][STATES["now_playing"]]["lyrics"][i]
                    time = line["time"]
                    if time > pygame.mixer.music.get_pos() / 1000:
                        now_lyric = i - 2 + ((pygame.mixer.music.get_pos() / 1000 - last_time) / (time - last_time + 1e-6)) ** 0.1
                        break
                    last_time = time
                else:
                    now_lyric = i - 2 + ((min(STATES["song_list"][STATES["now_playing"]]["lyrics"][-1]["time"] + 4.39, pygame.mixer.music.get_pos() / 1000) - last_time) / (min(STATES["song_list"][STATES["now_playing"]]["lyrics"][-1]["time"] + 4.39, STATES["song_list"][STATES["now_playing"]]["data"]["time"] / 1000) - last_time + 1e-6)) ** 0.1
            for i in range(len(STATES["song_list"][STATES["now_playing"]]["lyrics"])):
                if abs(i - now_lyric) < 1.5:
                    line = (STATES["song_list"][STATES["now_playing"]]["lyrics"])[i]
                    time = line["time"]
                    text = CFVI.draw.text(font, line["text"], (255, 255, 255), min_width=screen.get_height())
                    text_burr = CFVI.draw.text(font, line["text"], (0, 0, 0), min_width=screen.get_height())
                    for x, y in [(2, 0), (1, 1), (0, 2), (-1, 1), (-2, 0), (-1, -1), (0, -2), (1, -1)]:
                        screen.blit(text_burr, (int(screen.get_height() / 2 - text_burr.get_width() / 2 + x), int(screen.get_height() / 2 + (i - now_lyric) * screen.get_height() * 0.1 - text_burr.get_height() / 2 + y)))
                    screen.blit(text, (screen.get_height() / 2 - text.get_width() / 2, screen.get_height() / 2 + (i - now_lyric) * screen.get_height() * 0.1 - text.get_height() / 2))

        # imgui
        imgui.new_frame()
        imgui.push_font(imgui_font)
        imgui.set_next_window_position(_screen.get_height(), 0)
        imgui.set_next_window_size(_screen.get_width() - _screen.get_height(), _screen.get_height())
        imgui.begin("Songs", True, imgui.WINDOW_NO_TITLE_BAR | imgui.WINDOW_NO_RESIZE | imgui.WINDOW_NO_MOVE | imgui.WINDOW_NO_SAVED_SETTINGS)
        if imgui.begin_tab_bar("Pages"):
            if imgui.begin_tab_item(lang("Play")).selected:
                imgui.text(STATES["song_list"].get(STATES["now_playing"], {"name": ""})["name"])
                imgui.progress_bar(pygame.mixer.music.get_pos() / STATES["song_list"].get(STATES["now_playing"], {}).get("data", "")["time"] if STATES["now_playing"] else 0, (imgui.get_column_width(), 8))
                if imgui.button(lang("Previous"), 128, 32):
                    play_previous_song()
                imgui.same_line()
                if STATES.get("is_playing", False):
                    if imgui.button(lang("Pause"), 128, 32):
                        pause_song()
                else:
                    if imgui.button(lang("Play"), 128, 32):
                        if STATES["now_playing"]:
                            pause_song()
                        elif STATES["song_list"]:
                            first_song_id = list(STATES["song_list"].keys())[0]
                            play_song(first_song_id)
                imgui.same_line()
                if imgui.button(lang("Next"), 128, 32):
                    play_next_song()

                imgui.begin_child("##SongListScroll", 0, 0, True)
                imgui.begin_table("##SongList", 2, imgui.TABLE_ROW_BACKGROUND | imgui.TABLE_RESIZABLE)
                imgui.table_setup_column(lang("Title"))
                imgui.table_setup_column(lang("Artist"))
                imgui.table_headers_row()
                for song_id, song_info in STATES["song_list"].items():
                    imgui.table_next_row()
                    imgui.table_set_column_index(0)
                    selectable_flags = imgui.SELECTABLE_SPAN_ALL_COLUMNS
                    if song_id == STATES["now_playing"]:
                        selectable_flags |= imgui.SELECTABLE_DONT_CLOSE_POPUPS
                    if imgui.selectable(f"{song_info.get('name', '')}##{song_id}", song_id == STATES["now_playing"], selectable_flags)[0]:
                        play_song(song_id)
                    imgui.table_set_column_index(1)
                    imgui.text(" & ".join(song_info.get("artist", [])))
                imgui.end_table()
                imgui.end_child()
                imgui.end_tab_item()
            if imgui.begin_tab_item(lang("Download")).selected:
                _, STATES["search_text"] = imgui.input_text("##SearchText", STATES.get("search_text", ""))
                imgui.same_line()
                if imgui.button(lang("Search")):
                    start_search()
                imgui.same_line()
                imgui.text(lang(STATES.get("search_status", "Idle")))
                imgui.separator()
                imgui.begin_child("##SearchResultScroll", 0, 0, True)
                if STATES.get("search_results"):
                    imgui.begin_table("##SearchResults", 3, imgui.TABLE_ROW_BACKGROUND | imgui.TABLE_RESIZABLE)
                    imgui.table_setup_column(lang("Title"))
                    imgui.table_setup_column(lang("Artist"))
                    imgui.table_setup_column(lang("Action"))
                    imgui.table_headers_row()
                    for song in STATES["search_results"]:
                        imgui.table_next_row()
                        imgui.table_set_column_index(0)
                        imgui.text(song.get("name", ""))
                        imgui.table_set_column_index(1)
                        artists = song.get("artist", [])
                        imgui.text(" & ".join(artists))
                        imgui.table_set_column_index(2)
                        song_id = str(song.get("id", ""))
                        status = STATES["download_status"].get(song_id, "")
                        if status:
                            imgui.text(status)
                        else:
                            if imgui.button(lang("Download") + f"##{song_id}"):
                                add_to_download_queue(song_id)
                            if song_id in STATES["song_list"]:
                                imgui.same_line()
                                imgui.text(lang("Downloaded"))
                    imgui.end_table()
                imgui.end_child()
                imgui.end_tab_item()
            if imgui.begin_tab_item(lang("Settings")).selected:
                _, lang_index = imgui.combo(lang("Language"), STATES["settings"].get("language", 0), ["en"] + [lang for lang in LANGUAGES])
                STATES["settings"]["language"] = lang_index
                _, play_mv = imgui.checkbox(lang("Play MV"), STATES["settings"].get("play_mv", False))
                STATES["settings"]["play_mv"] = play_mv
                imgui.end_tab_item()
            imgui.end_tab_bar()
        imgui.end()
        imgui.pop_font()

        # RenderLoop
        render_loop(_screen, screen, texture_id, impl)

    pygame.quit()
    with open(STATES["settings_path"], "w", encoding="utf-8") as f:
        f.write(json.dumps(STATES["settings"]))
    return


if __name__ == "__main__":
    main()
