import socketio
import eventlet
from aiohttp import web
import fitz

from zipfile import ZipFile
import json
import binascii 
import os
import shutil
import glob

static_files = {
    '/': './public/'
}

sio = socketio.Server()
app = socketio.WSGIApp(sio, static_files = static_files)

@sio.event
def connect(sid, environ):
    os.mkdir("./public/tmp/" + str(sid))
    print("New user:", sid)

@sio.on("load novel")
def load_novel(sid, novel):
    global light_novel
    light_novel = fitz.open("./public/" + novel)

@sio.on("load page")
def load_page(sid, page_num):
    global page
    page = light_novel[page_num - 1]

@sio.on("search text")
def search_text(sid, character):
    text_instances = page.searchFor(character)
    for instance in text_instances:
        sio.emit("locations", [character, [point for point in instance]])

@sio.on("upload pdf")
def save_pdf(sid, pdf_file, pdf_name):
    # removes all other files since this is new PDF
    for f in glob.glob("./public/tmp/" + str(sid) + "/*"):
        os.remove(f)

    with open("./public/tmp/" + str(sid) + "/" + pdf_name, "wb") as f:
        f.write(binascii.a2b_base64(pdf_file.split(",")[1]))
    sio.emit("pdf uploaded", "./tmp/" + str(sid) + "/" + pdf_name)

@sio.on("upload img")
def save_img(sid, character, img_file, img_name, settings):
    with open("./public/tmp/" + str(sid) + "/" + img_name, "wb") as f:
        f.write(binascii.a2b_base64(img_file.split(",")[1]))

    settings["search"][character]["img"] = [img_name, "./tmp/" + str(sid) + "/" + img_name]

    sio.emit("img uploaded", settings)

@sio.on("save state")
def save_state(sid, settings):
    filename = os.path.basename(settings["file"])[0:-4]
    with open("./public/tmp/" + str(sid) + "/" + filename + ".json", "w") as outfile:
        json.dump(settings, outfile)

    zip_obj = ZipFile("./public/tmp/" + str(sid) + "/" + filename + ".zip", "w")
    for f in glob.glob("./public/tmp/" + str(sid) + "/*"):
        if os.path.splitext(os.path.basename(f))[1] != ".zip":
            zip_obj.write(f, os.path.basename(f))

    sio.emit("download ready", [filename + ".zip", "./tmp/" + str(sid) + "/" + filename + ".zip"])

@sio.on("load state")
def load_state(sid, zip_file):
    for f in glob.glob("./public/tmp/" + str(sid) + "/*"):
        os.remove(f)

    with open("./public/tmp/" + str(sid) + "/temp.zip", "wb") as f:
        f.write(binascii.a2b_base64(zip_file))

    with ZipFile("./public/tmp/" + str(sid) + "/temp.zip", "r") as zip_obj:
        zip_obj.extractall("./public/tmp/" + str(sid))
    settings = json.load(open(glob.glob("./public/tmp/" + str(sid) + "/*.json")[0], "r"))

    if settings["file"][0:6] == "./tmp/":
        settings["file"] = "./tmp/" + str(sid) + "/" + os.path.basename(settings["file"])

    for character in settings["search"]:
        if type(settings["search"][character]["img"]) is list:
            settings["search"][character]["img"][1] = "./tmp/" + str(sid) + "/" + os.path.basename(settings["search"][character]["img"][0])

    sio.emit("state loaded", settings)


@sio.event
def disconnect(sid):
    print("Goodbye,", sid)
    shutil.rmtree("./public/tmp/" + str(sid))

if __name__ == "__main__":
    eventlet.wsgi.server(eventlet.listen(('localhost', 8080)), app)
