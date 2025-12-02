import pygame
import CFVI.music
import CFVI.draw
import CFVI.os
import CFVI.updater
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
import subprocess

sys.modules["importlib.metadata"].version = lambda pkg: "0.0.0"
import moviepy


NAME = "39MusicPlayer"
CREATOR = "A439"
VERSION = "0.7.1"


def resource_path(relative_path):
    try:
        base_path = sys._MEIPASS
    except AttributeError:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)


STATES = {}
LOCK = threading.Lock()
LANGUAGES = json.load(open(resource_path("./resources/languages.json"), "r", encoding="utf-8"))
THEMES = json.load(open(resource_path("./resources/themes.json"), "r", encoding="utf-8"))
FONTS: list[str] = [
    "unifont.otf",
    "851.ttf",
    "HarmonyOS Sans.ttf",
]


def lang(text):
    lang = (["en"] + [lang for lang in LANGUAGES])[STATES["settings"].get("language", 0)]
    return LANGUAGES[lang].get(text, text) if lang in LANGUAGES else text


def theme(ket):
    theme = (["default"] + [theme for theme in THEMES])[STATES["settings"].get("theme", 0)]
    return THEMES[theme].get(ket, None) if theme in THEMES else None


class DownloadThread(threading.Thread):
    def __init__(self, song_id):
        super().__init__()
        self.song_id = song_id
        self.daemon = True

    def run(self):
        with LOCK:
            STATES["download_status"][self.song_id] = "Downloading"
        try:
            path = f"{STATES["settings"]["download_path"]}\\{self.song_id}"
            song_info = CFVI.music.api.info(self.song_id)
            print(f"[{self.song_id}][0/2]Fetching song info")
            song = CFVI.music.api.song(self.song_id)
            if song_info["privilege"]["pl"] <= 0:
                if True:  # VIP
                    for i in CFVI.music.api.song2(self.song_id):
                        song[i] = CFVI.music.api.song2(self.song_id)[i]
                else:
                    print(f"[{self.song_id}][0/2]Song is not available")
                    with LOCK:
                        STATES["download_status"][self.song_id] = "Error: No privilege!"
                    return
            song_data = requests.get(song["url"]).content
            print(f"[{self.song_id}][1/2]Downloaded song")
            song.pop("url")
            pic_url = song_info["pic"]
            pic_data = requests.get(pic_url).content
            print(f"[{self.song_id}][2/2]Downloaded picture")
            song_info.pop("pic")
            song_info["data"] = song
            lyrics = CFVI.music.api.lyric(self.song_id)
            if lyrics:
                for i in lyrics:
                    song_info[i] = lyrics[i]
            mv = CFVI.music.api.mv(song_info["mv"]) if song_info.get("mv") else None
            if mv:
                song_info["mv"] = mv["url"]
            mv_data = requests.get(mv["url"]).content if mv else None
            if mv_data:
                print(f"[{self.song_id}][3/3]Downloaded MV")
            if not os.path.exists(path):
                os.makedirs(path)
            with open(f"{path}\\info.json", "w", encoding="utf-8") as f:
                json.dump(song_info, f)
            with open(f"{path}\\song.{song_info['data']['type']}", "wb") as f:
                f.write(song_data)
            with open(f"{path}\\pic.jpg", "wb") as f:
                f.write(pic_data)
            if mv_data:
                with open(f"{path}\\mv.mp4", "wb") as f:
                    f.write(mv_data)
            with open(f"{path}\\{CFVI.os.safe_filename(" & ".join(song_info['artist']) + "-" + song_info['name'])}", "w") as f:
                f.write("")
            with LOCK:
                STATES["download_status"][self.song_id] = "Completed"
                if self.song_id in STATES["download_queue"]:
                    STATES["download_queue"].remove(self.song_id)
                refresh_song_list()
        except Exception as e:
            with LOCK:
                STATES["download_status"][self.song_id] = f"Error: {str(e)}"
            print(f"Failed to download song: {e}")


def redownload_all_songs():
    """删除并重新下载所有歌曲"""
    song_ids = list(STATES["song_list"].keys())
    for song_id in song_ids:
        # if song_id in list(STATES["song_list"].keys()):
        #     continue
        delete_song(song_id)
        with LOCK:
            if song_id not in STATES["download_queue"]:
                STATES["download_queue"].append(song_id)
                STATES["download_status"][song_id] = "Queued"
                download_thread = DownloadThread(song_id)
                download_thread.start()


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
    font_config = imgui.FontConfig(merge_mode=True)
    font_path = resource_path(f"./resources/{FONTS[STATES["settings"].get("ui_font", 0)]}")
    font = io.fonts.add_font_from_file_ttf(font_path, 16, None, io.fonts.get_glyph_ranges_default())
    font = io.fonts.add_font_from_file_ttf(font_path, 16, font_config, io.fonts.get_glyph_ranges_chinese_full())
    font = io.fonts.add_font_from_file_ttf(font_path, 16, font_config, io.fonts.get_glyph_ranges_latin())
    font = io.fonts.add_font_from_file_ttf(font_path, 16, font_config, io.fonts.get_glyph_ranges_japanese())
    font = io.fonts.add_font_from_file_ttf(font_path, 16, font_config, io.fonts.get_glyph_ranges_korean())
    font = io.fonts.add_font_from_file_ttf(font_path, 16, font_config, io.fonts.get_glyph_ranges_cyrillic())
    font = io.fonts.add_font_from_file_ttf(font_path, 16, font_config, io.fonts.get_glyph_ranges_vietnamese())
    font = io.fonts.add_font_from_file_ttf(font_path, 16, font_config, io.fonts.get_glyph_ranges_thai())
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


def get_song_sort_key(song_info):
    """获取歌曲排序键值：作者-专辑-歌名"""
    artists = song_info.get("artist", [])
    artist = artists[0] if artists else ""
    album = song_info.get("album", "")
    name = song_info.get("name", "")
    return (artist, album, name)


def refresh_song_list():
    refresh_thread = threading.Thread(target=_refresh_song_list_worker)
    refresh_thread.daemon = True
    refresh_thread.start()


def _refresh_song_list_worker():
    """实际执行刷新操作的线程函数"""
    with LOCK:
        was_playing = STATES.get("is_playing", False)
        now_playing_id = STATES.get("now_playing")
        STATES["sorted_song_ids"] = []
        STATES["song_list"] = {}
        songs_path = STATES["settings"]["download_path"]
        if not os.path.exists(songs_path):
            os.makedirs(songs_path)
            return
        search_text = STATES["local_search_text"].strip().lower()
        for song_id in os.listdir(songs_path):
            info_path = os.path.join(songs_path, song_id, "info.json")
            if os.path.exists(info_path):
                playlist_setting = STATES["settings"].get("playlist", 0)
                if playlist_setting == 0 or is_song_in_playlist(song_id, playlist_setting - 1):
                    try:
                        with open(info_path, "r", encoding="utf-8") as f:
                            song_info = json.load(f)
                        if search_text == "" or _matches_search(song_info, search_text):
                            STATES["song_list"][song_id] = song_info
                    except Exception as e:
                        print(f"Error loading song info {info_path}: {e}")
        STATES["sorted_song_ids"] = sorted(STATES["song_list"].keys(), key=lambda song_id: get_song_sort_key(STATES["song_list"][song_id]))
        if was_playing and now_playing_id and now_playing_id not in STATES["sorted_song_ids"]:
            pygame.mixer.music.stop()
            pygame.mixer.music.unload()
            STATES["now_playing"] = None
            STATES["is_playing"] = False


def _matches_search(song_info, search_text):
    """检查歌曲信息是否匹配搜索文本"""
    if not search_text:
        return True
    if search_text in str(song_info).lower():
        return True
    return False


def play_song(song_id):
    print(f"Playing song {song_id}")
    STATES["now_playing"] = song_id
    STATES["song_bg"] = None
    STATES["song_mv"] = None
    song_path = f"{STATES["settings"]["download_path"]}\\{song_id}\\song.{STATES['song_list'][song_id]['data']['type']}"
    if not pygame.mixer.get_init():
        pygame.mixer.init()
    try:
        pygame.mixer.music.stop()
        pygame.mixer.music.load(song_path)
        pygame.mixer.music.play()
        STATES["is_playing"] = True
        STATES["start_play_time"] = pygame.time.get_ticks()
        STATES["song_length"] = STATES["song_list"][song_id]["data"]["time"]
    except Exception as e:
        print(f"Failed to play song: {e}")
        STATES["now_playing"] = None
        STATES["is_playing"] = False
    STATES["song_data"], STATES["song_sr"] = soundfile.read(song_path)
    bg_path = f"{STATES["settings"]["download_path"]}\\{song_id}\\pic.jpg"
    bg = pygame.image.load(bg_path) if os.path.exists(bg_path) else None
    if bg:
        STATES["song_bg"] = pygame.transform.smoothscale(bg, (STATES["screen_size"][1], STATES["screen_size"][1]))
    mv_path = f"{STATES["settings"]["download_path"]}\\{song_id}\\mv.mp4"
    mv = moviepy.VideoFileClip(mv_path) if STATES["settings"].get("play_mv", False) and os.path.exists(mv_path) else None
    if mv:
        STATES["song_mv"] = mv


def pause_song():
    if STATES.get("is_playing", False):
        pygame.mixer.music.pause()
        STATES["is_playing"] = False
        STATES["start_pause_time"] = pygame.time.get_ticks()
    else:
        pygame.mixer.music.unpause()
        STATES["is_playing"] = True
        STATES["start_play_time"] += pygame.time.get_ticks() - STATES["start_pause_time"]


def play_next_song():
    if not STATES.get("sorted_song_ids"):
        return
    if STATES["now_playing"] in STATES["sorted_song_ids"]:
        current_index = STATES["sorted_song_ids"].index(STATES["now_playing"])
        next_index = (current_index + 1) % len(STATES["sorted_song_ids"])
        play_song(STATES["sorted_song_ids"][next_index])


def play_previous_song():
    if not STATES.get("sorted_song_ids"):
        return
    if STATES["now_playing"] in STATES["sorted_song_ids"]:
        current_index = STATES["sorted_song_ids"].index(STATES["now_playing"])
        previous_index = (current_index - 1) % len(STATES["sorted_song_ids"])
        play_song(STATES["sorted_song_ids"][previous_index])


def delete_song(song_id):
    try:
        if STATES.get("now_playing") == song_id:
            pygame.mixer.music.stop()
            pygame.mixer.music.unload()
            STATES["now_playing"] = None
            STATES["is_playing"] = False
        song_path = f"{STATES["settings"]["download_path"]}\\{song_id}"
        if os.path.exists(song_path):
            import shutil

            shutil.rmtree(song_path)
        with LOCK:
            if song_id in STATES["song_list"]:
                del STATES["song_list"][song_id]
            if song_id in STATES["sorted_song_ids"]:
                STATES["sorted_song_ids"].remove(song_id)
            if song_id in STATES["download_status"]:
                del STATES["download_status"][song_id]
            if song_id in STATES["download_queue"]:
                STATES["download_queue"].remove(song_id)

        print(f"Deleted song: {song_id}")

    except Exception as e:
        print(f"Failed to delete song {song_id}: {e}")


def cut(lst, i):
    result = []
    for j in range(i - 512, i + 512):
        if j >= 0 and j < len(lst):
            result.append(lst[j])
        else:
            result.append(numpy.zeros(lst[0].shape))
    return result


def sigmoid(x):
    return 1 / (1 + numpy.exp(-x))


class SearchThread(threading.Thread):
    def __init__(self, search_text, page=0):
        super().__init__()
        self.search_text = search_text
        self.page = page
        self.daemon = True

    def run(self):
        try:
            with LOCK:
                STATES["search_status"] = "Searching"
            search_results = CFVI.music.api.search(self.search_text, limit=STATES.get("search_count", 30), page=self.page)
            with LOCK:
                STATES["search_results"] = search_results
                STATES["search_status"] = "Completed"
                STATES["search_current_page"] = self.page
        except Exception as e:
            print(f"Failed to search: {e}")
            with LOCK:
                STATES["search_status"] = f"Error: {str(e)}"
            print(f"Failed to search: {e}")


def start_search(page=0):
    if STATES.get("search_text", "").strip():
        STATES["search_status"] = "Searching"
        STATES["search_results"] = []
        search_thread = SearchThread(STATES["search_text"], page)
        search_thread.start()


def add_to_download_queue(song_id):
    with LOCK:
        if song_id in STATES["download_queue"] and STATES["download_status"][song_id].startswith("Error: "):
            STATES["download_queue"].remove(song_id)
        if song_id not in STATES["download_queue"]:
            STATES["download_queue"].append(song_id)
            STATES["download_status"][song_id] = "Queued"
            download_thread = DownloadThread(song_id)
            download_thread.start()


def create_new_playlist(name):
    """创建新的播放列表"""
    print(f"Creating new playlist: {name}")
    STATES["settings"]["playlists"] = STATES["settings"].get("playlists", [])
    for playlist in STATES["settings"]["playlists"]:
        if playlist["name"] == name:
            print(f"Playlist '{name}' already exists!")
            return False
    STATES["settings"]["playlists"].append({"name": name, "songs": []})
    print(f"Playlist '{name}' created successfully!")
    return True


def delete_current_playlist(playlist_index):
    """删除当前播放列表"""
    if not STATES["settings"].get("playlists"):
        print("No playlists available to delete!")
        return False
    if 0 <= playlist_index < len(STATES["settings"]["playlists"]):
        deleted_playlist = STATES["settings"]["playlists"].pop(playlist_index)
        print(f"Deleted playlist: {deleted_playlist['name']}")
        if not STATES["settings"]["playlists"]:
            STATES["settings"]["playlist"] = None
        else:
            STATES["settings"]["playlist"] = 0
        return True
    else:
        print("Invalid playlist index!")
        return False


def get_playlist_songs(playlist_index):
    """获取播放列表的歌曲"""
    if not STATES["settings"].get("playlists"):
        print("No playlists available!")
        return []
    if playlist_index is None or not (0 <= playlist_index < len(STATES["settings"]["playlists"])):
        print("Invalid playlist index!")
        return []
    playlist = STATES["settings"]["playlists"][playlist_index]
    return playlist["songs"]


def add_song_to_playlist(song_id, playlist_index):
    """将歌曲添加到播放列表"""
    if not STATES["settings"].get("playlists"):
        print("No playlists available!")
        return False
    if playlist_index is None or not (0 <= playlist_index < len(STATES["settings"]["playlists"])):
        print("Invalid playlist index!")
        return False
    playlist = STATES["settings"]["playlists"][playlist_index]
    if song_id in playlist["songs"]:
        print(f"Song {song_id} already exists in playlist!")
        return False
    playlist["songs"].append(song_id)
    print(f"Added song {song_id} to playlist '{playlist['name']}'")
    return True


def remove_song_from_playlist(song_id, playlist_index):
    """从播放列表中移除歌曲"""
    if not STATES["settings"].get("playlists"):
        print("No playlists available!")
        return False
    if playlist_index is None or not (0 <= playlist_index < len(STATES["settings"]["playlists"])):
        print("Invalid playlist index!")
        return False
    playlist = STATES["settings"]["playlists"][playlist_index]
    if song_id not in playlist["songs"]:
        print(f"Song {song_id} not found in playlist!")
        return False
    playlist["songs"].remove(song_id)
    print(f"Removed song {song_id} from playlist '{playlist['name']}'")
    return True


def is_song_in_playlist(song_id, playlist_index):
    """判断歌曲是否在播放列表中"""
    if not STATES["settings"].get("playlists"):
        return False
    if playlist_index is None or not (0 <= playlist_index < len(STATES["settings"]["playlists"])):
        return False
    playlist = STATES["settings"]["playlists"][playlist_index]
    return song_id in playlist["songs"]


def main():
    pygame.init()
    _screen: pygame.Surface = pygame.display.set_mode((1280, 720), pygame.DOUBLEBUF | pygame.OPENGL, vsync=1)
    pygame.display.set_caption(f"{NAME} v{VERSION}")
    pygame.display.set_icon(pygame.image.load(resource_path("./resources/39.png")))
    screen = pygame.Surface(_screen.get_size(), pygame.SRCALPHA)

    # variables
    STATES["screen_size"] = _screen.get_size()
    STATES["settings_path"] = f"{os.environ.get('APPDATA')}\\{CREATOR}\\{NAME}\\settings.json"
    STATES["song_list"] = {}
    STATES["sorted_song_ids"] = []
    STATES["download_status"] = {}
    STATES["download_queue"] = []
    STATES["now_playing"] = None
    STATES["is_playing"] = False
    STATES["search_text"] = ""
    STATES["search_results"] = []
    STATES["search_status"] = "Idle"
    STATES["search_current_page"] = 0
    STATES["local_search_text"] = ""
    CFVI.os.unlock_file(os.path.join(STATES["settings_path"], ".."))
    with CFVI.os.FileUnlocker(STATES["settings_path"]):
        STATES["settings"] = json.loads(open(STATES["settings_path"], "r", encoding="utf-8").read()) if os.path.exists(STATES["settings_path"]) else {}
    if "download_path" not in STATES["settings"]:
        STATES["settings"]["download_path"] = f"{os.environ.get('APPDATA')}\\{CREATOR}\\{NAME}\\song"
    if not os.path.exists(STATES["settings"]["download_path"]):
        os.makedirs(STATES["settings"]["download_path"])
    refresh_song_list()

    texture_id = setup_opengl(_screen)
    impl, imgui_font = setup_imgui(_screen)
    running = True

    # resources
    font = pygame.font.Font(resource_path(f"./resources/{FONTS[STATES["settings"].get("lyrics_font", 1)]}"), int(screen.get_height() * 0.0439))

    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            impl.process_event(event)

        pygame.mixer.music.set_volume(STATES["settings"].get("volume", 0.5))
        if STATES.get("now_playing") and STATES["current_time"] > STATES.get("song_length", 0):
            play_song(STATES["sorted_song_ids"][numpy.random.randint(0, len(STATES["sorted_song_ids"]))])
        STATES["current_time"] = pygame.time.get_ticks() - STATES.get("start_play_time", pygame.time.get_ticks()) if STATES.get("is_playing") else STATES.get("current_time", 0)

        screen.fill((0, 0, 0))
        if STATES.get("song_bg"):
            screen.blit(STATES["song_bg"], (0, 0))
        if STATES.get("now_playing"):
            STATES["song_data_index"] = int(STATES["current_time"] / 1000 * STATES["song_sr"])
            STATES["song_data_cut"] = numpy.mean(cut(STATES.get("song_data", []), STATES["song_data_index"]), axis=1)
            STATES["song_data_fft"] = numpy.abs(numpy.fft.ihfft(STATES["song_data_cut"]))
            STATES["song_data_fft_mean"] = STATES.get("song_data_fft_mean", numpy.zeros(len(STATES["song_data_fft"])))
            STATES["song_data_fft_mean"] = [STATES["song_data_fft_mean"][i] + (STATES["song_data_fft"][i] - STATES["song_data_fft_mean"][i]) * 0.439 for i in range(len(STATES["song_data_fft"]))]
            if STATES["settings"].get("vibrate", True):
                virbo = numpy.var(STATES["song_data_fft"][:15])
                for i in range(screen.get_height()) if virbo > 0.001 else []:
                    if 1 + numpy.sin(numpy.tan(i**3 * STATES["song_data_index"])) > 0.25:
                        screen.blit(screen, (int((numpy.sin(numpy.tan(i**2 * STATES["song_data_index"]))) * virbo * screen.get_height() * 4.39), i), (0, i, screen.get_height(), 1))
        screen.fill((0, 0, 0), (screen.get_height(), 0, screen.get_width() - screen.get_height(), screen.get_height()))
        if STATES.get("song_mv"):
            frame = pygame.surfarray.make_surface(STATES["song_mv"].get_frame(STATES["current_time"] / 1000).swapaxes(0, 1))
            frame = pygame.transform.scale_by(frame, screen.get_height() / frame.get_width())
            screen.blit(frame, (0, screen.get_height() / 2 - frame.get_height() / 2))
        if STATES.get("now_playing"):
            STATES["rs"] = [numpy.mean(STATES["song_data_fft"][:50])] + STATES.get("rs", [0] * 2)[:-1]
            CFVI.draw.ring(screen, (screen.get_height() / 2, screen.get_height() / 2), screen.get_height() * 0.2 + numpy.mean(STATES["rs"]) * 4.39 * screen.get_height(), screen.get_height() * 0.1, (255, 255, 255, 128))

        poses = [] if len(STATES.get("song_data_fft_mean", [])) else [(0, screen.get_height()), (screen.get_height(), screen.get_height())]
        for i in range(len(STATES.get("song_data_fft_mean", []))):
            x = i / len(STATES["song_data_fft_mean"]) * screen.get_height()
            y = screen.get_height() * (1.5 - sigmoid(numpy.mean(STATES["song_data_fft_mean"][i]) * 43.9))
            poses.append((x, y))
        for offset in [(2, 0), (1, 1), (0, 2), (-1, 1), (-2, 0), (-1, -1), (0, -2), (1, -1)]:
            pygame.draw.aalines(screen, (0, 0, 0), False, [(pos[0] + offset[0], pos[1] + offset[1]) for pos in poses], 2)
        pygame.draw.aalines(screen, (255, 255, 255), False, poses, 2)

        if STATES["settings"].get("show_lyrics", True) and STATES["current_time"] > 0 and STATES.get("now_playing") and STATES["song_list"].get(STATES["now_playing"], {}).get("lyrics"):
            with LOCK:
                lyric_type = "tlyrics" if STATES["settings"].get("show_tlyric", False) and "tlyrics" in STATES["song_list"][STATES["now_playing"]] else "lyrics"
                now_lyric = 0
                last_time = 0
                for i in range(len(STATES["song_list"][STATES["now_playing"]][lyric_type]) + 1):
                    if i < len(STATES["song_list"][STATES["now_playing"]][lyric_type]):
                        line = STATES["song_list"][STATES["now_playing"]][lyric_type][i]
                        time = line["time"]
                        if time > STATES["current_time"] / 1000:
                            now_lyric = i - 2 + ((STATES["current_time"] / 1000 - last_time) / (time - last_time + 1e-6)) ** 0.1
                            break
                        last_time = time
                    else:
                        now_lyric = i - 2 + ((min(STATES["song_list"][STATES["now_playing"]][lyric_type][-1]["time"] + 4.39, STATES["current_time"] / 1000) - last_time) / (min(STATES["song_list"][STATES["now_playing"]][lyric_type][-1]["time"] + 4.39, STATES["song_list"][STATES["now_playing"]]["data"]["time"] / 1000) - last_time + 1e-6)) ** 0.1
                for i in range(max(int(now_lyric), 0), min(int(now_lyric + 3), len(STATES["song_list"][STATES["now_playing"]][lyric_type]))):
                    line = (STATES["song_list"][STATES["now_playing"]][lyric_type])[i]
                    time = line["time"]
                    text = CFVI.draw.text_ex(font, line["text"], (255, 255, 255), min_width=screen.get_height())
                    text_burr = CFVI.draw.blur(CFVI.draw.text_ex(font, line["text"], (0, 0, 0), min_width=screen.get_height()))
                    for x, y in [(2, 0), (1, 1), (0, 2), (-1, 1), (-2, 0), (-1, -1), (0, -2), (1, -1)]:
                        screen.blit(text_burr, (int(screen.get_height() / 2 - text_burr.get_width() / 2 + x), int(screen.get_height() / 2 + (i - now_lyric) * screen.get_height() * 0.1 - text_burr.get_height() / 2 + y)))
                    screen.blit(text, (screen.get_height() / 2 - text.get_width() / 2, screen.get_height() / 2 + (i - now_lyric) * screen.get_height() * 0.1 - text.get_height() / 2))

        # imgui
        imgui.new_frame()
        pushed_colors = 0
        theme_index = STATES["settings"].get("theme", 0)
        if theme_index > 0:
            theme_name = list(THEMES.keys())[min(theme_index - 1, len(THEMES) - 1)]
            theme_colors = THEMES[theme_name]
            for item_name, color_values in theme_colors.items():
                item_value = [value / 255 for value in color_values]
                eval(f"imgui.push_style_color(imgui.{item_name}, *{item_value})")
                pushed_colors += 1
        imgui.push_font(imgui_font)
        imgui.set_next_window_position(_screen.get_height(), 0)
        imgui.set_next_window_size(_screen.get_width() - _screen.get_height(), _screen.get_height())
        imgui.begin("Songs", True, imgui.WINDOW_NO_TITLE_BAR | imgui.WINDOW_NO_RESIZE | imgui.WINDOW_NO_MOVE | imgui.WINDOW_NO_SAVED_SETTINGS)
        if imgui.begin_tab_bar("Pages"):
            if imgui.begin_tab_item(lang("Play")).selected:
                imgui.text(f"{STATES["song_list"].get(STATES["now_playing"], {"name": ""})["name"]}")
                imgui.same_line()
                imgui.text_colored(f"{STATES["song_list"].get(STATES["now_playing"], {"album": ""})["album"]}", 0.5, 0.5, 0.5)
                # try:
                progress = max(0, STATES["current_time"]) / STATES.get("song_length", 0) if STATES["now_playing"] else 0
                imgui.set_next_item_width(imgui.get_column_width())
                _, select_progress = imgui.slider_float("##Progress", progress, 0, 1, "")
                if _ and STATES["now_playing"]:
                    next_time = int(select_progress * STATES.get("song_length", 0) / 1000)
                    STATES["start_play_time"] += STATES["current_time"] - next_time * 1000
                    pygame.mixer.music.set_pos(next_time)
                current_time = f"{int(STATES["current_time"] / 60000)}:{int(numpy.mod(max(STATES["current_time"] / 1000, 0), 60)):02d}"
                total_time = f"{int(STATES['song_list'].get(STATES['now_playing'], {'data': {'time': 0}}).get('data', {'time': 0})['time'] / 60000)}:{int(numpy.mod(max(STATES['song_list'].get(STATES['now_playing'], {'data': {'time': 0}}).get('data', {'time': 0})['time'] / 1000, 0), 60)):02d}"
                available_width = imgui.get_content_region_available().x
                imgui.text(current_time)
                imgui.same_line()
                imgui.set_cursor_pos_x(available_width - imgui.calc_text_size(total_time).x)
                imgui.text(total_time)
                imgui.separator()
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
                        elif STATES["sorted_song_ids"]:
                            play_song(STATES["sorted_song_ids"][0])
                imgui.same_line()
                if imgui.button(lang("Next"), 128, 32):
                    play_next_song()

                STATES["local_search_text"] = imgui.input_text("##LocalSearchText", STATES.get("local_search_text", ""), 256)[1]
                imgui.same_line()
                if imgui.button(lang("Search")):
                    refresh_song_list()

                # playlist here
                _, playlist_index = imgui.combo(lang("Playlists"), STATES["settings"].get("playlist", 0), [lang("All")] + [playlist["name"] for playlist in STATES["settings"].get("playlists", [])] + [lang("Delete current")])
                STATES["new_playlist_name"] = imgui.input_text("##NewPlaylistName", STATES.get("new_playlist_name", ""), 256)[1]
                imgui.same_line()
                if imgui.button(lang("Create")):
                    create_new_playlist(STATES.get("new_playlist_name", ""))
                if _:
                    if playlist_index == len(STATES["settings"].get("playlists", [])) + 1:
                        delete_current_playlist(STATES["settings"]["playlist"] - 1)
                    STATES["settings"]["playlist"] = playlist_index
                    refresh_song_list()

                imgui.begin_child("##SongListScroll", 0, 0, True)
                imgui.begin_table("##SongList", 3, imgui.TABLE_ROW_BACKGROUND)
                imgui.table_setup_column(lang("Title"))
                imgui.table_setup_column(lang("Artist"))
                imgui.table_setup_column(lang("Action"))
                imgui.table_headers_row()
                for song_id in STATES.get("sorted_song_ids", []):
                    if song_info := STATES["song_list"].get(song_id, None):
                        imgui.table_next_row()
                        imgui.table_set_column_index(2)
                        _, action_index = imgui.combo(f"##{song_id}Action", 0, [lang("Play"), lang("Open in explorer"), lang("Delete")] + [f"{lang("Add to playlist:") if not is_song_in_playlist(song_id, i) else lang("Remove from playlist:")} {playlist["name"]}" for i, playlist in enumerate(STATES["settings"].get("playlists", []))])
                        if _:
                            if action_index == 0:
                                play_song(song_id)
                            elif action_index == 1:
                                os.startfile(os.path.join(STATES["settings"]["download_path"], song_id))
                            elif action_index == 2:
                                delete_song(song_id)
                                _refresh_song_list_worker()
                            else:
                                if is_song_in_playlist(song_id, action_index - 3):
                                    remove_song_from_playlist(song_id, action_index - 3)
                                else:
                                    add_song_to_playlist(song_id, action_index - 3)
                                refresh_song_list()
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
                    start_search(0)
                imgui.same_line()
                imgui.text(lang(STATES.get("search_status", "Idle")))
                imgui.separator()
                imgui.text(f"{lang("Page")}: {STATES.get('search_current_page', 0) + 1}")
                imgui.same_line()
                if imgui.button(lang("Previous page")) and STATES.get("search_current_page", 0) > 0:
                    start_search(STATES.get("search_current_page", 0) - 1)
                imgui.same_line()
                if imgui.button(lang("Next page")):
                    start_search(STATES.get("search_current_page", 0) + 1)
                imgui.begin_child("##SearchResultScroll", 0, 0, True)
                if STATES.get("search_results"):
                    imgui.begin_table("##SearchResults", 3, imgui.TABLE_ROW_BACKGROUND)
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
                            if status.startswith("Error: ") and imgui.button(lang("Retry") + f"##{song_id}"):
                                add_to_download_queue(song_id)
                            imgui.text(lang(status))
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
                _, theme_index = imgui.combo(lang("Theme"), STATES["settings"].get("theme", 0), ["default"] + [theme for theme in THEMES])
                STATES["settings"]["theme"] = theme_index
                _, play_mv = imgui.checkbox(lang("Play MV"), STATES["settings"].get("play_mv", False))
                STATES["settings"]["play_mv"] = play_mv
                if False:
                    _, download_path = imgui.input_text(f"{lang("Download path")}", STATES["settings"].get("download_path", ""), 256)
                    STATES["settings"]["download_path"] = download_path
                    imgui.same_line()
                    if imgui.button(lang("Browse")):
                        root = tkinter.Tk()
                        root.withdraw()
                        folder_path = thinker.filedialog.askdirectory()
                        if folder_path:
                            STATES["settings"]["download_path"] = folder_path
                        root.destroy()
                    if STATES["settings"]["download_path"] != STATES["settings"]["download_path"]:
                        STATES["settings"]["download_path"] = STATES["settings"]["download_path"]
                        refresh_song_list()
                _, STATES["search_count"] = imgui.input_int(lang("Search count"), STATES.get("search_count", 30), 1, 100)
                _, STATES["settings"]["show_lyrics"] = imgui.checkbox(lang("Lyrics"), STATES["settings"].get("show_lyrics", True))
                if STATES["settings"]["show_lyrics"]:
                    imgui.same_line()
                    _, STATES["settings"]["show_tlyric"] = imgui.checkbox(lang("Tlyric"), STATES["settings"].get("show_tlyric", False))
                _, STATES["settings"]["volume"] = imgui.slider_float(lang("Volume"), STATES["settings"].get("volume", 0.5), 0, 1)
                # if imgui.button(lang("Redownload All Songs")):
                #     redownload_all_songs()
                _, lyrics_font_index = imgui.combo(lang("Lyrics font"), STATES["settings"].get("lyrics_font", 1), [".".join(font.split(".")[:-1]) for font in FONTS])
                STATES["settings"]["lyrics_font"] = lyrics_font_index
                if _:
                    font = pygame.font.Font(resource_path(f"./resources/{FONTS[STATES["settings"]["lyrics_font"]]}"), int(screen.get_height() * 0.0439))
                _, ui_font_index = imgui.combo(lang("UI font"), STATES["settings"].get("ui_font", 0), [".".join(font.split(".")[:-1]) for font in FONTS])
                STATES["settings"]["ui_font"] = ui_font_index
                if imgui.is_item_hovered():
                    imgui.set_tooltip(lang("Restart to apply"))
                _, STATES["settings"]["vibrate"] = imgui.checkbox(lang("Vibrate"), STATES["settings"].get("vibrate", True))
                imgui.end_tab_item()
            imgui.end_tab_bar()
        imgui.end()
        imgui.pop_font()
        if pushed_colors > 0:
            imgui.pop_style_color(pushed_colors)

        # RenderLoop
        render_loop(_screen, screen, texture_id, impl)

    pygame.quit()
    with CFVI.os.FileUnlocker(STATES["settings_path"]):
        with open(STATES["settings_path"], "w", encoding="utf-8") as f:
            f.write(json.dumps(STATES["settings"]))
            f.flush()
    CFVI.os.lock_file(STATES["settings_path"])


def update_a(path):
    if not os.path.exists(path):
        try:
            print(f"Updating...")
            if info := CFVI.updater.check_update(NAME, VERSION):
                if url := info["assets"][0].get("browser_download_url"):
                    print(f"Downloading update: {info['tag_name']}")
                    r = requests.get(url, verify=False)
                    open(path, "wb").write(r.content)
                    print(f"Update downloaded successfully!")
            else:
                print(f"No update available")
        except Exception as e:
            print(f"Failed to check for updates: {e}")


def update_b(path):
    if os.path.exists(path):
        current_path = sys.executable if hasattr(sys, "frozen") else sys.argv[0]
        current_dir = os.path.dirname(current_path)
        try:
            bat_content = f"""@echo off
timeout /t 2 /nobreak >nul
taskkill /F /PID {os.getpid()} >nul 2>&1
move /Y "{path}" "{current_path}"
start "" "{current_path}"
del "%~f0"
"""
            bat_path = os.path.join(current_dir, "update.bat")
            with open(bat_path, "w") as f:
                f.write(bat_content)
            print(f"Update will be installed after restart...")
            subprocess.Popen([bat_path], shell=True, creationflags=subprocess.CREATE_NO_WINDOW)
            sys.exit(0)
        except Exception as e:
            print(f"Failed to install update: {e}")
    else:
        print(f"No update found at {path}")


if __name__ == "__main__":
    # start update
    path = f"{os.environ.get('APPDATA')}\\{CREATOR}\\{NAME}\\NewUpdate.exe"
    threading.Thread(target=update_a, args=(path,)).start()
    main()
    update_b(path)
