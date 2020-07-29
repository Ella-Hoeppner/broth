# Broth
Broth is a javascript-based artificial life simulation. Broth defines a 2D environment in which particles can interact and join together to form more complex structures. The aim of Broth is to be able to support open-ended neodarwinian evolution, just as happens in the biosphere on Earth. An overview of the goals of Broth, along with the way that the simulation works, is available here: http://fourstrands.org/?p=1075

# Running Broth
Broth is implemented using an html5 canvas, which means that it can be run in any modern web browser. If you'd like to run Broth locally, you can close this repository, and then start a local web server in the directory where you downloaded it (you can do this by running the command `python -m http.server` if you have python 3 installed), and then accessing the server in your browser (if you're using `python -m http.server`, you can do this by simply visiting `http://localhost:8000/`).

There'ss an instance of Broth running on my personal website at https://www.ellahoeppner.com/broth/index.html. If you use this version and you'd like to see the replicator that I've designed, you'll need to download the "states" folder in this github repository and load the "default.json" file in Broth manually. See the "Saving and Loading States" section for more details

# Using Broth

## Camera Movement and Zoom
You can move the camera in Broth by using the W, A, S, and D keys. Additionally, you can zoom in with the scroll wheel. By default, the camera is maximally zoomed out and centered on the center of the map, so the entire map is visible when first starting the program. The top right of the canvas shows a display that allows you to see where the camera view lies within the map.

## Pausing and Simulation Speed
Broth can be paused by pressing the spacebar, or by clicking on the pause icon near the bottom right of the canvas. Once the simulation is paused, you can press the spacebar again or press the play icon (which replaces the pause icon while the simulation is paused) to unpause the simulation.

updates
## Using Tools

In the bottom left corner of the canvas, there is a toolbar containing several tools that allow you to interact with the particles in the simulation. Each of these tools can be selected by clicking on the corresponding icon with the mouse, or by using the hotkey on the keyboard that corresponds to the tool. Broth currently contains four commands, presented in the same order that they appear on the toolbar:

Fling (hotkey "f"): With the fling tool selected, you can click on any particle in the simulation, and then drag your mouse in a direction. When you release the mouse, momentum will be added to the selected particle based on how you moved the mouse after clicking the particle. This tool allows you to impart forces on particles to move them however you like.

Delete (hotkey "x"): When you click on a particle with the delete tool selected, it will be immediately removed from the simulation.

Program (hotkey "p"): Clicking on a control particle with the tool selected allows you to modify the code and internal state of the particle, and also pauses the simulation. See the "Modifying Controller Code" section for more details.

Inspect (hotkey "i"): The inspect tool is used to view extra information about a particle. For now, control particles are the only kind of particle that respond to the inspect tool. When you select a control particle with the inspect tool, you will see the region in which that control particle is searching for a particle, if the particle specifies any such region.

## Creating Particles

Above the toolbar, there is a bar of particle icons. If you select one these icons with your mouse, you can then click anywhere on the canvas to add a particle of the corresponding type to the simulation. You can also select these icons by using the number keys on the keyboard.

The particle bar contains the three main types of particles that have been implemented so far: The controller, the binder, and the battery. However, there are two more particles available on the bar which are currently only partially implemented. I don't recommend using these particles at the moment, as they don't yet do anything interesting and haven't been tested much.

## Modifying Controller Code
In Broth, each control particle contains Lisp code that defines 4 functions. Below the canvas and the buttons for saving and loading states, there are several text boxes that allow you to modify the Lisp code that a control particle contains. There is a text box for each of the four functions in a control particle, along with two extra text boxes that can be used to edit the internal state of a control particle and its current update delay.

By default these text boxes are empty and will not accept any input. You can modify the code, internal state, and update delay of a control particle by selecting it with the "Program" tool (which can be selected by pressing "p", or clicking on the third icon in the toolbar). While a particle is selected with the Program tool, the simulation will automatically be paused.

## Saving and Loading States
Directly beneath the canvas, there are two buttons labeled "Save State" and "Load State". When you press the "Save State" button, the current state of the simulation you are running will be exported as a json file, which will then immediately be downloaded through your browser. You can then, at a later point in time, load the same state by using the "Load State" button and selecting the saved json file in the prompt.

The "states" folder in this repository contains a collection of states that may be useful for someone experimenting for Broth.