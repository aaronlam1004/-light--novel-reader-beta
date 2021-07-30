var canvas = document.getElementById("pdf-render");
var ctx = canvas.getContext('2d');

var pdfSettings = {
    file: "Yahari Ore no Seishun Love Comedy wa Machigatteiru - Volume 1.pdf",
    numOfPages: 0,
    page: 1,
    zoom: 1,
    search: {
    },
}

var socket = io.connect(); // creates socket.io connection
var loader; // Object that represents the loaded PDF file 

var index = 0; // int that represents index of character clicked in character menu
var menuOn = false; // bool that determines if context menu is showing

// used to load the PDF file int pdfSettings
//      >>> pdf -> string -> file name/directory/URL
function loadPDF(pdf = null) {
    if (pdf != null) {
        pdfSettings["file"] = pdf;
        pdfSettings["page"] = 1;
        pdfSettings["zoom"] = 1;
        pdfSettings["search"] = {};
    }

    loader = pdfjsLib.getDocument(pdfSettings["file"]); // loads PDF into pdfjsLib
    loader.promise.then(pdf => {
        pdfSettings.numOfPages = pdf.numPages;
        document.getElementById("num-of-pages").innerHTML = "/" + pdfSettings["numOfPages"];
        document.getElementById("page-num").max = pdfSettings["numOfPages"];
    });

    socket.emit("load novel", pdfSettings["file"]).promise; // sends socket message to have server load PDF
    socket.emit("load page", pdfSettings.page).promise; // sends socket message to have server load page of PDF

    document.getElementById("page-num").value = pdfSettings["page"];
}


// renders page into viewer
function render() {

    // clear all previous highlights before rendering PDF page
    Object.keys(pdfSettings.search).forEach(character => {
        pdfSettings.search[character].highlights = [];
    });
    
    loader.promise.then(pdf => {
        pdf.getPage(pdfSettings.page).then(page => {
            var viewport = page.getViewport({scale: pdfSettings.zoom}); // adjust scale of page view

            // adjust canvas width and height to match the page
            canvas.width = viewport.width; 
            canvas.height = viewport.height;

            // renders the page
            page.render({canvasContext: ctx, viewport: viewport}).promise.then(() => {
                Object.keys(pdfSettings.search).forEach(character => {
                    socket.emit("search text", character); // sends socket message to have server search text for each character in search
                });
            })
            
        });
    });
}

// changes the page that is viewed
//      >>> pageNum -> int -> page #
function changePage(pageNum) {
    if (pageNum >= 1 && pageNum <= pdfSettings.numOfPages) {
        pdfSettings.page = pageNum;
        socket.emit("load page", pdfSettings.page).promise;
        render();
        document.getElementById("page-num").value = pdfSettings.page;
    }
}

document.getElementById("next-page").addEventListener("click", e => {changePage(pdfSettings.page + 1);});
document.getElementById("prev-page").addEventListener("click", e => {changePage(pdfSettings.page - 1);});

// changes how zoomed the page is viewed to zoomValue
//      >>> zoomValue -> int -> zoom amount
function changeZoom(zoomValue) {
    if (zoomValue >= 1) {
        pdfSettings.zoom = zoomValue;
        render();
    }
}

document.getElementById("zoom-in").addEventListener("click", e => {changeZoom(pdfSettings.zoom + 1);});
document.getElementById("zoom-out").addEventListener("click", e => {changeZoom(pdfSettings.zoom - 1);});

// shows the highlight form with all the options that users can change 
function showHighlightForm(event) {
    var placeholder = "Click here to edit character"; // represents uninitialized highlight

    document.getElementById("highlight-form").style.visibility = "visible";
    var highlightList = document.getElementsByClassName("highlight-choice");

    // gets the highlight option that the user selects (clicked on) from the highlight list 
    for (var i = 0; i < highlightList.length; i++) {
        if (highlightList[i] === event.target) {
            index = i;
        }
    }

    // user clicks on a highlight that is already initialized
    if (event.target.innerHTML !== placeholder) {
        document.getElementById("character-name").value = event.target.innerHTML;

        // changes highlight option form if character img is URL link 
        if (typeof pdfSettings.search[event.target.innerHTML]["img"] === "string") {
            document.getElementById("image-url").value = pdfSettings.search[event.target.innerHTML]["img"];
            document.getElementById("profile").src = pdfSettings.search[event.target.innerHTML]["img"];
            document.getElementById("image-file").innerHTML = "";
        }
        // changes highlight option form if character img is upload 
        else {
            document.getElementById("image-file").innerHTML = ` ${pdfSettings.search[event.target.innerHTML]["img"][0]}`;
            document.getElementById("profile").src = pdfSettings.search[event.target.innerHTML]["img"][1];
            document.getElementById("image-url").value = "";
        }

        document.getElementById("color-option").value = pdfSettings.search[event.target.innerHTML]["color"];
    }
    // user clicks on highlight that is not initialized
    else {
        document.getElementById("character-name").value = "";
        document.getElementById("image-url").value = "";
        document.getElementById("image-upload").value = "";
        document.getElementById("image-file").innerHTML = "";
        document.getElementById("color-option").value = "#000000";
    }
}


// updates the img based on whether it is URL or upload
//      >>> isUpload -> bool -> whether the img is an uploaded img or a URL
function updateImage(isUpload) {
    var character = document.getElementById("character-name").value;
    if (character != "") {
        if (!isUpload) {
            pdfSettings.search[character]["img"] = document.getElementById("image-url").value;  
            document.getElementById("image-upload").value = "";
            document.getElementById("image-file").innerHTML = "";
            render();
        }
        else {
            var image = document.getElementById("image-upload").files[0];
            document.getElementById("image-file").innerHTML = ` ${image.name}`;
            var reader = new FileReader();
            reader.onload = function(e) {
                socket.emit("upload img", character, e.target.result, image.name, pdfSettings).promise;
            }
            reader.readAsDataURL(image);
            document.getElementById("image-url").value = "";    
        }
    }
}

document.getElementById("image-url").addEventListener("change", e => {updateImage(false);});
document.getElementById("image-upload").addEventListener("change", e => {updateImage(true);});

// updates highlights on PDF based on changes on highlight form
function updateHighlights() {
    var character = document.getElementById("character-name").value;
    var rgb = document.getElementById("color-option").value;

    if (!Object.keys(pdfSettings.search).includes(character)) {
        pdfSettings.search[character] = {img: "", color: rgb, highlights: []};
        if (document.getElementById("image-url").value != "") {
            updateImage(false);
        }
        else if (document.getElementById("image-upload").value != "") {
            updateImage(true);
        }
    }
    else {
        pdfSettings.search[character]["color"] = rgb;
    }

    var names = [];
    var highlightList = document.getElementsByClassName("highlight-choice");
    for (var i = 0; i < highlightList.length; i++) {
        if (i === index && character != "") {
            highlightList[i].innerHTML = character;
        }
        names.push(highlightList[i].innerHTML);
    }

    Object.keys(pdfSettings.search).forEach(character => {
        if (!names.includes(character)) {
            delete pdfSettings.search[character];
        }
    });

    render();
}

document.getElementById("character-name").addEventListener("keyup", updateHighlights);
document.getElementById("color-option").addEventListener("change", updateHighlights);

// adds search term 
function addCharacter() {
    var newCharacter = document.createElement("li");

    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "selection";

    var placeholder = document.createElement("span");
    placeholder.className = "highlight-choice";
    placeholder.innerHTML = "Click here to edit character";
    placeholder.addEventListener("click", showHighlightForm);
 
    newCharacter.appendChild(checkbox);
    newCharacter.appendChild(placeholder);

    document.getElementById("highlight-list").appendChild(newCharacter);
}

// removes search term
function removeCharacter() {
    var selections = document.getElementsByClassName("selection");

    // checks to see if the number of user highlights is greater than 1 (no point in removing if there is only 1 in the entire list)  
    if (selections.length > 1) {
        var checked = []; 
        for (var i = 0; i < selections.length; i++) {
            if (selections[i].checked) {
                var removal = document.getElementsByClassName("highlight-choice")[i];

                // hides highlight option form if the soon to be removed highlight is what is on the form 
                if (document.getElementById("character-name").value === removal.innerHTML) {
                    document.getElementById("highlight-form").style.visibility = "hidden";      
                }

                // delete highlight from user settings so client no longer looks for it 
                delete pdfSettings["search"][removal.innerHTML];
                checked.push(i);
            }
        }

        // deletes the checked like a stack, most recent highlight (that is checked) to oldest 
        //      >>> have to delete by using list because if it is in prev for loop the index of the checked checkbox repeats
        Object(checked.reverse()).forEach(index => {
            document.getElementById("highlight-list").removeChild(document.getElementById("highlight-list").getElementsByTagName("li")[index]);
        });
    }
    render();
};

// saves the current user's settings (page num, zoom val, pdf, highlights, etc.)
function saveSettings() {
    socket.emit("save state", pdfSettings);
}

// loads a .zip file that contains a user's save settings (page num, zoom val, pdf, highlights, etc.)
function loadSettings(event) {
    var reader = new FileReader();
    reader.onload = function(e) {
        socket.emit("load state", e.target.result);

        canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
        canvas.getContext("2d").fillText("Loading", 200, 200);

        document.getElementById("highlight-list").innerHTML = "";
        document.getElementById("highlight-form").style.visibility = "hidden";
    }
    reader.readAsDataURL(event.target.files[0]);
}

// opens the prompt to upload PDF
function openPDFPrompt() {
    var overlay = document.getElementById("overlay");
    overlay.style.display = "block";
    overlay.style.width = window.innerWidth + "px";
    overlay.style.height = window.innerHeight + "px";

    var dialog = document.getElementById("prompt");
    dialog.style.display = "block";
    dialog.style.position = "absolute";
    dialog.style.left = (window.innerWidth / 2) - 200 + "px";
    dialog.style.top = "100px";
}

// closes the prompt to upload PDF
function closePDFPrompt() {
    document.getElementById("overlay").style.display = "none";
    document.getElementById("prompt").style.display = "none";
}

// when user uploads a PDF to be viewed
function uploadPDF(event) {
    var reader = new FileReader();
    reader.onload = function(e) {
        socket.emit("upload pdf", e.target.result, event.target.files[0].name).promise;

        canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
        canvas.getContext("2d").fillText("Loading", 200, 200);

        document.getElementById("highlight-list").innerHTML = "";
        document.getElementById("highlight-form").style.visibility = "hidden";

        addCharacter();
    }
    reader.readAsDataURL(event.target.files[0]);
}

// when certain keys are pressed 
document.addEventListener("keydown", e => {
    switch(e.keyCode) {
        case 39: // -> 
            changePage(pdfSettings.page + 1); // next page 
            break;
        case 37: // <-
            changePage(pdfSettings.page - 1); // previous page
            break;
        case 187: // (+=) key
            changeZoom(pdfSettings.zoom + 1); // zoom in
            break;
        case 189: // (-_) key
            changeZoom(pdfSettings.zoom - 1); // zoom out
            break;
    }
});

document.addEventListener("click", e => {
    // turns off context menu if it is on 
    if (menuOn) {
        menu.style.display = "none";
        menuOn = false;
    }
});

// event handler for the page number input to change page of PDF to given page number
document.getElementById("page-num").addEventListener("change", e => {
    changePage(parseInt(document.getElementById("page-num").value, 10));
});


// right-clicking on the canvas shows different context menu 
canvas.addEventListener("contextmenu", e => {
    e.preventDefault();
    var menu = document.getElementById("menu");
    menu.style.display = "block";
    menu.style.left = e.pageX + "px";
    menu.style.top = e.pageY + "px";
    menuOn = true;
});

// mouse movement event handler on canvas 
canvas.addEventListener("mousemove", e => {

    var mouseX = e.pageX - (canvas.offsetLeft + canvas.clientLeft); 
    var mouseY = e.pageY - (canvas.offsetTop + canvas.clientTop);

    Object.keys(pdfSettings["search"]).forEach(person => {
        var character = pdfSettings.search[person];
        for (var i = 0; i < character.highlights.length; i++) {

            // checks to see if  mouse is hovering region where the higlight is located on the PDF
            if (mouseX >= character.highlights[i][0]  && mouseX <= character.highlights[i][1] &&
                mouseY >= character.highlights[i][2]  && mouseY <= character.highlights[i][3] + (pdfSettings.zoom * 10)) {

                // sets img of profile based on whether the character img is a URL (string) or an uploaded img (array)
                if (typeof character["img"] === "string") {
                    document.getElementById("profile").src = character["img"];
                }
                else {
                    document.getElementById("profile").src = character["img"][1];
                }   
            }
        }
    });
});

// mouse click event handler on canvas 
canvas.addEventListener("click", e => {

    // turns off context menu if it is on 
    if (menuOn) {
        menu.style.display = "none";
        menuOn = false;
    }
    else {
        var mouseX = e.pageX - (canvas.offsetLeft + canvas.clientLeft); 

        // changes page based on where user clicks on the canvas
        //      >>> [OXX]   goes to prev page
        //      >>> [XXO]   goes to next page
        if (mouseX > canvas.width - (canvas.width / 3)) {
            changePage(pdfSettings.page + 1);
        }
        else if (mouseX < (canvas.width / 3)) {
            changePage(pdfSettings.page - 1);
        }
    }
});

// server sends location of highlight regions
socket.on("locations", highlight => {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = pdfSettings.search[highlight[0]]["color"];
    const x = highlight[1][0] * pdfSettings.zoom;
    const y = highlight[1][1] * pdfSettings.zoom;
    const width = (highlight[1][2] - highlight[1][0]) * pdfSettings.zoom;
    const height = (highlight[1][3] - highlight[1][1]) * pdfSettings.zoom;
    ctx.fillRect(x, y, width, height);
    pdfSettings.search[highlight[0]]["highlights"].push([x, x + width, y, y + height]);
});

// server sends that PDF has been fully uploaded 
socket.on("pdf uploaded", saved => {
    document.getElementById("novel-loader").value = "";
    loadPDF(saved);
    render();
});

// server sends that img has been fully uploaded 
socket.on("img uploaded", updated => {
    pdfSettings = updated;
});

// server sends that user state is ready to be downloaded 
socket.on("download ready", zipFile => {
    var download = document.createElement("a");
    download.href = zipFile[1];
    download.download = zipFile[0];
    download.click();
});

// server sends that user state has been fully loaded 
socket.on("state loaded", updated => {
    document.getElementById("upload-pdf").value = "";

    loadPDF(updated["file"])
    pdfSettings = updated;
    changePage(pdfSettings["page"]);
    changeZoom(pdfSettings["zoom"]);

    const characters = Object.keys(pdfSettings["search"])
    addCharacter();
    for (var i = 0; i < characters.length; i++) {
        document.getElementsByClassName("highlight-choice")[i].innerHTML = characters[i];
        if (i != characters.length - 1) {
            addCharacter();
        }
    }
    
});

loadPDF();
render();
