import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { parseForm } from "@focaui/parse-form";
import { PaintingOptions, generateLayerList } from "./utils/painting";

const distance = ([x1, y1]: [number, number], [x2, y2]: [number, number]) => {
  return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
};

const closePath = (path: [number, number][], minDistance: number) => {
  const closingPath: [number, number][] = [];
  const [x0, y0] = path[0];
  const [xn, yn] = path[path.length - 1];
  const dist = distance([x0, y0], [xn, yn]);
  const n = Math.floor(dist / minDistance);
  for (let i = 1; i < n; i++) {
    const pm: [number, number] = [xn + ((x0 - xn) * i) / n, yn + ((y0 - yn) * i) / n];
    closingPath.push(pm);
  }
  return [...path, ...closingPath];
};

const randomizePath = (path: [number, number][]) => {
  return path.map(([x, y]) => [x, y, Math.random()] as [number, number, number]);
};

const clearCanvas = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#ffffff";
  context.globalAlpha = 1;
  context.fillRect(0, 0, canvas.width, canvas.height);
};

const drawPainting = async (
  canvas: HTMLCanvasElement,
  {
    width,
    height,
    path,
    baseRadius,
    temperature,
    iterations,
    color,
    alpha,
    layers,
    preIterations,
  }: PaintingOptions
) => {
  const context = canvas.getContext("2d")!;
  if (width > canvas.width || height > canvas.height) {
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    if (width > canvas.width) {
      canvas.width = width;
    }
    if (height > canvas.height) {
      canvas.height = height;
    }
    clearCanvas(canvas);
    context.putImageData(imageData, 0, 0);
  }

  const upperCanvas = document.createElement("canvas");
  const upperContext = upperCanvas.getContext("2d")!;
  upperCanvas.width = width;
  upperCanvas.height = height;
  upperContext.fillStyle = color;
  upperContext.globalAlpha = alpha;

  return new Promise<void>((resolve) => {
    setTimeout(() => {
      const layerList = generateLayerList({
        path,
        baseRadius,
        temperature,
        iterations,
        layers,
        preIterations,
      });
      layerList.forEach((layerPath) => {
        upperContext.beginPath();
        layerPath.forEach(([x, y], i) => {
          if (i) {
            upperContext.lineTo(x, y);
          } else {
            upperContext.moveTo(x, y);
          }
        });
        upperContext.closePath();
        upperContext.fill("evenodd");
      });
      context.drawImage(upperCanvas, 0, 0);
      resolve();
    }, 0);
  });
};

function FormField({
  name,
  type,
  value,
  defaultValue,
  before,
  after,
  onChange,
}: {
  name?: string;
  type?: React.HTMLInputTypeAttribute;
  value?: string | number;
  defaultValue?: string | number;
  before?: React.ReactNode;
  after?: React.ReactNode;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="mx-2 my-1 py-1">
      <label>
        {before}
        <input
          className="
            w-24 mx-2 px-2 border-b-2 text-center border-gray-400
            focus:outline-none focus:border-blue-500 transition-colors
          "
          name={name}
          type={type}
          value={value}
          defaultValue={defaultValue}
          onChange={(ev) => {
            if (onChange) {
              onChange(ev.currentTarget.value);
            }
          }}
        />
        {after}
      </label>
    </div>
  );
}

function App() {
  const [colors, setColors] = useState([
    "#ff0000",
    "#ffff00",
    "#00ff00",
    "#00ffff",
    "#0000ff",
    "#ff00ff",
  ]);
  const minDistance = 16;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [, setHistory] = useReducer(
    (
      state: { history: ImageData[]; index: number },
      action: "push" | "undo" | "redo" | "clear"
    ) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return state;
      }
      const context = canvas.getContext("2d")!;

      const { history, index: _index } = Object.assign({}, state);
      let index = _index;
      switch (action) {
        case "push":
          history.splice(index);
          history.push(context.getImageData(0, 0, canvas.width, canvas.height));
          index++;
          break;
        case "undo":
          if (index > 0) {
            clearCanvas(canvas);
            if (index > 1) {
              context.putImageData(history[index - 2], 0, 0);
            }
            index--;
          }
          break;
        case "redo":
          if (index < history.length) {
            clearCanvas(canvas);
            context.putImageData(history[index], 0, 0);
            index++;
          }
          break;
        case "clear":
          history.splice(0);
          index = 0;
          break;
      }
      return { history, index };
    },
    { history: [], index: 0 }
  );

  const [selectedColorIndex, setSelectedColorIndex] = useState(-1);

  const [resizeMouseDown, setResizeMouseDown] = useState(false);
  const minWidth = 256;
  const minHeight = 256;
  const [width, setWidth] = useState(512);
  const [height, setHeight] = useState(512);

  const [canvasMouseDown, setCanvasMouseDown] = useState(false);
  const [path, setPath] = useState<[number, number][]>([]);

  const [pending, setPending] = useState(false);

  const pathStr = useMemo(() => {
    const d = path
      .map(([x, y], i) => {
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
    return d && d + " Z";
  }, [path]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      clearCanvas(canvas);
      // setHistory("push");
    }
  }, []);

  const onSubmit = async (form: HTMLFormElement) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const data = parseForm(form);
    const layers = data[":layers"];
    const alpha = data[":alpha"];
    const iterations = data[":iterations"];
    const preIterations = data[":pre-iterations"];
    const baseRadius = data[":base-radius"];
    const temperature = data[":temperature"];
    const color = data["$color"];

    const errorMessages: string[] = [];
    if (path.length < 2) {
      errorMessages.push("Please select an area.");
    }
    if (!color) {
      errorMessages.push("Please select a color.");
    }
    if (layers === undefined || layers <= 0) {
      errorMessages.push("Layers must be a valid positive number.");
    }
    if (alpha === undefined || alpha < 0 || alpha > 1) {
      errorMessages.push("Layer opacity must be a valid number between 0 and 1.");
    }
    if (iterations === undefined || iterations < 0) {
      errorMessages.push("Iterations must be a valid non-negative number.");
    }
    if (preIterations === undefined || preIterations < 0) {
      errorMessages.push("Preprocess iterations must be a valid non-negative number.");
    }
    if (baseRadius === undefined || baseRadius < 0) {
      errorMessages.push("Base radius must be a valid non-negative number.");
    }
    if (temperature === undefined || temperature < 0 || temperature > 1) {
      errorMessages.push("Temperature must be a valid number between 0 and 1.");
    }

    if (errorMessages.length) {
      alert(errorMessages.join("\n"));
      return;
    }

    const options: PaintingOptions = {
      width,
      height,
      path: randomizePath(path),
      layers,
      alpha,
      iterations,
      preIterations,
      baseRadius,
      temperature,
      color,
    } as PaintingOptions;

    setPending(true);
    await drawPainting(canvas, options);
    setPending(false);
    setPath([]);
    setHistory("push");
  };

  return (
    <>
      <div className="absolute p-4 left-0 top-0 w-full h-full">
        <div className="w-full h-full">
          <div className="inline-block p-2 w-1/4 align-top">
            <form
              className="select-none"
              autoComplete="off"
              onSubmit={(ev) => {
                ev.preventDefault();
                onSubmit(ev.currentTarget);
              }}
            >
              <FormField
                name="layers"
                type="text"
                defaultValue="128"
                before={<span>Layers</span>}
              ></FormField>
              <FormField
                name="alpha"
                type="text"
                defaultValue="0.008"
                before={<span>Layer opacity</span>}
              ></FormField>
              <FormField
                name="iterations"
                type="text"
                defaultValue="5"
                before={<span>Iterations</span>}
              ></FormField>
              <FormField
                name="pre-iterations"
                type="text"
                defaultValue="2"
                before={<span>Preprocess Iterations</span>}
              ></FormField>
              <FormField
                name="base-radius"
                type="text"
                defaultValue="32"
                before={<span>Base Radius</span>}
              ></FormField>
              <FormField
                name="temperature"
                type="text"
                defaultValue="0.7"
                before={<span>Temperature</span>}
              ></FormField>
              <div className="mx-2 my-1">
                <div>
                  <span>Select color</span>
                  <label>
                    <input
                      className="absolute w-0 h-0"
                      type="color"
                      defaultValue="#ff0000"
                      onBlur={(ev) => {
                        const inputColor = ev.currentTarget.value;
                        if (colors.indexOf(inputColor) === -1) {
                          setColors([...colors, inputColor]);
                        }
                      }}
                    />
                    <span className="mx-1 text-blue-500 cursor-pointer">Add</span>
                  </label>
                  <span
                    className="mx-1 text-red-500 cursor-pointer"
                    onClick={() => {
                      setColors(colors.filter((_, i) => i !== selectedColorIndex));
                    }}
                  >
                    Remove
                  </span>
                </div>
                <div className="my-1 leading-none">
                  {colors.map((color, i) => {
                    return (
                      <label key={i} className="contents">
                        <input
                          className="absolute w-0 h-0 peer"
                          name="color"
                          type="radio"
                          value={color}
                          onChange={(ev) => {
                            if (ev.currentTarget.checked) {
                              setSelectedColorIndex(i);
                            }
                          }}
                        />
                        <div
                          className="
                            inline-block mx-1 my-1 w-8 h-8 rounded-md cursor-pointer
                            outline outline-2 outline-gray-300 peer-checked:outline-black
                          "
                          style={{ backgroundColor: color }}
                        ></div>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="mx-2 my-1">
                <button
                  className="
                    mx-1 my-1 px-2 py-0.5 rounded-md text-white
                    bg-blue-500 hover:bg-blue-400 active:bg-blue-300
                    disabled:bg-blue-300 disabled:cursor-not-allowed
                  "
                  type="submit"
                  disabled={pending}
                >
                  Draw
                </button>
                <button
                  className="
                    mx-1 my-1 px-2 py-0.5 rounded-md text-white
                    bg-amber-500 hover:bg-amber-400 active:bg-amber-300
                    disabled:bg-red-300 disabled:cursor-not-allowed
                  "
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setHistory("undo");
                  }}
                >
                  Undo
                </button>
                <button
                  className="
                    mx-1 my-1 px-2 py-0.5 rounded-md text-white
                    bg-amber-500 hover:bg-amber-400 active:bg-amber-300
                    disabled:bg-green-300 disabled:cursor-not-allowed
                  "
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setHistory("redo");
                  }}
                >
                  Redo
                </button>
                <button
                  className="
                    mx-1 my-1 px-2 py-0.5 rounded-md text-white
                    bg-red-500 hover:bg-red-400 active:bg-red-300
                    disabled:bg-red-300 disabled:cursor-not-allowed
                  "
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm("Clear painting? This action cannot be restored.")) {
                      return;
                    }
                    const canvas = canvasRef.current;
                    if (canvas) {
                      clearCanvas(canvas);
                      setHistory("clear");
                    }
                  }}
                >
                  Clear
                </button>
              </div>
              <div className="mx-2 my-1">
                <button
                  className="
                    mx-1 my-1 px-4 py-0.5 rounded-md text-white
                    bg-green-500 hover:bg-green-400 active:bg-green-300
                    disabled:bg-green-300 disabled:cursor-not-allowed
                  "
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    const canvas = canvasRef.current;
                    if (canvas) {
                      const name = prompt("Enter filename:");
                      if (!name) {
                        return;
                      }

                      const tempCanvas = document.createElement("canvas");
                      const tempContext = tempCanvas.getContext("2d")!;
                      tempCanvas.width = width;
                      tempCanvas.height = height;
                      clearCanvas(tempCanvas);
                      tempContext.drawImage(canvas, 0, 0);

                      const link = document.createElement("a");
                      link.href = tempCanvas.toDataURL();
                      link.download = name.endsWith(".png") ? name : `${name}.png`;
                      link.click();
                    }
                  }}
                >
                  Download
                </button>
              </div>
            </form>
          </div>
          <div className="inline-block p-2 w-3/4 align-top">
            <div
              className="relative outline outline-black outline-2 bg-white"
              style={{ width, height, pointerEvents: (pending || undefined) && "none" }}
            >
              <div className="relative w-full h-full overflow-hidden">
                <canvas ref={canvasRef} className="absolute" />
                <svg
                  className="absolute cursor-crosshair z-10"
                  width={width}
                  height={height}
                  onPointerDown={(ev) => {
                    setCanvasMouseDown(true);
                    ev.currentTarget.setPointerCapture(ev.pointerId);
                    const rect = ev.currentTarget.getBoundingClientRect();
                    const [x, y] = [ev.clientX - rect.left, ev.clientY - rect.top];
                    setPath([[x, y]]);
                  }}
                  onPointerMove={(ev) => {
                    if (canvasMouseDown) {
                      const rect = ev.currentTarget.getBoundingClientRect();
                      const [x, y] = [ev.clientX - rect.left, ev.clientY - rect.top];
                      const [xn, yn] = path[path.length - 1];
                      if (!path.length || distance([x, y], [xn, yn]) > minDistance) {
                        setPath([...path, [x, y]]);
                      }
                    }
                  }}
                  onPointerUp={(ev) => {
                    setCanvasMouseDown(false);
                    ev.currentTarget.releasePointerCapture(ev.pointerId);
                    if (path.length < 2) {
                      setPath([]);
                      return;
                    }
                    setPath(closePath(path, minDistance));
                  }}
                >
                  <path
                    d={pathStr}
                    stroke="#000000"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    fill={colors[selectedColorIndex] || "none"}
                    fillOpacity={0.2}
                    fillRule="evenodd"
                  />
                </svg>
              </div>
              <div
                className="
                  absolute w-4 h-4 -right-2 -bottom-2 bg-white
                  outline outline-2 -outline-offset-4 outline-black cursor-nwse-resize z-20
                "
                onPointerDown={(ev) => {
                  setResizeMouseDown(true);
                  ev.currentTarget.setPointerCapture(ev.pointerId);
                }}
                onPointerMove={(ev) => {
                  if (resizeMouseDown) {
                    const rect = ev.currentTarget.parentElement!.getBoundingClientRect();
                    const [x, y] = [ev.clientX - rect.left, ev.clientY - rect.top];
                    setWidth(Math.max(x, minWidth));
                    setHeight(Math.max(y, minHeight));
                  }
                }}
                onPointerUp={(ev) => {
                  setResizeMouseDown(false);
                  ev.currentTarget.releasePointerCapture(ev.pointerId);
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
