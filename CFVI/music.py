import requests
import json
import urllib.parse
import pathlib


class api:
    root_url = "https://ncm.zhenxin.me"

    def search(text, limit=30, page=0):
        url = f"{api.root_url}/cloudsearch?&limit={limit}&offset={page*limit}&keywords={text}"
        response: dict = requests.get(url).json()
        if response["code"] != 200:
            print(response)
            return None
        result = []
        for item in response["result"].get("songs", []):
            id = item["id"]
            name = item["name"]
            artist = [artist["name"] for artist in item["ar"]]
            album = item["al"]["name"]
            pic = item["al"]["picUrl"]
            privilege = {
                "pl": item["privilege"]["pl"],
                "dl": item["privilege"]["dl"],
                "st": item["privilege"]["st"],
            }
            result.append(
                {
                    "id": id,
                    "name": name,
                    "artist": artist,
                    "album": album,
                    "pic": pic,
                    "privilege": privilege,
                }
            )
        return result

    def song(id):
        url = f"{api.root_url}/song/url?level=lossless&id={id}"
        response: dict = requests.get(url).json()
        if response["code"] != 200:
            print(response)
            return None
        result = {}
        result["id"] = id
        result["url"] = response["data"][0]["url"]
        result["size"] = response["data"][0]["size"]
        result["md5"] = response["data"][0]["md5"]
        result["type"] = response["data"][0]["type"]
        result["level"] = response["data"][0]["level"]
        result["time"] = response["data"][0]["time"]
        result["sr"] = response["data"][0]["sr"]
        result["br"] = response["data"][0]["br"]
        return result

    def info(id):
        url = f"{api.root_url}/song/detail?ids={id}"
        response: dict = requests.get(url).json()
        if response["code"] != 200:
            print(response)
            return None
        result = {}
        result["id"] = id
        result["name"] = response["songs"][0]["name"]
        result["artist"] = [artist["name"] for artist in response["songs"][0]["ar"]]
        result["album"] = response["songs"][0]["al"]["name"]
        result["pic"] = response["songs"][0]["al"]["picUrl"]
        result["mv"] = response["songs"][0]["mv"]
        result["privilege"] = {
            "pl": response["privileges"][0]["pl"],
            "dl": response["privileges"][0]["dl"],
            "st": response["privileges"][0]["st"],
        }
        return result

    def lyric(id):
        url = f"{api.root_url}/lyric?id={id}"
        response: dict = requests.get(url).json()
        if response["code"] != 200:
            print(response)
            return None
        result = {}
        result["id"] = id
        lyrics = []
        for line in response["lrc"]["lyric"].split("\n"):
            if not line.strip():
                continue
            time, text = line.split("]")
            time = time.strip("[")
            time = int(time.split(":")[0]) * 60 + float(time.split(":")[1].split("-")[0])
            text = text.strip()
            lyrics.append({"time": time, "text": text})
        result["lyrics"] = lyrics
        return result

    def mv(id):
        url = f"{api.root_url}/mv/url?id={id}"
        response: dict = requests.get(url).json()
        if response["code"] != 200:
            print(response)
            return None
        result = {}
        result["id"] = id
        result["url"] = response["data"]["url"]
        result["size"] = response["data"]["size"]
        result["st"] = response["data"]["st"]
        return result

    def song2(id):
        url = f"https://api.cenguigui.cn/api/netease/music_v1.php?id={id}&type=json&level=lossless"
        response: dict = requests.get(url).json()
        if response["code"] != 200:
            print(response)
            return None
        result = {}
        result["id"] = id
        result["url"] = response["data"]["url"]
        result["size"] = response["data"]["size"]
        result["time"] = (int(response["data"]["duration"].split(":")[0]) * 60 + float(response["data"]["duration"].split(":")[1])) * 1000
        result["type"] = pathlib.Path(urllib.parse.urlparse(result["url"]).path).suffix[1:]
        return result


if __name__ == "__main__":
    print(json.dumps(api.search("Stay")))
