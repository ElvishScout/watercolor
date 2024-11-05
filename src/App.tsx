import { useEffect, useMemo, useReducer, useState } from "react";
import { parseForm } from "@focaui/parse-form";
import { PaintingOptions, clearCanvas, paintToCanvas } from "./utils/painting";
import FormField from "./components/FormField";

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

export default function App() {
  const fields: Parameters<typeof FormField>[0][] = [
    {
      name: "layers",
      type: "number",
      defaultValue: "128",
      min: 1,
      required: true,
      before: "Layers",
    },
    {
      name: "alpha",
      type: "number",
      defaultValue: 0.008,
      min: 0,
      max: 1,
      step: "any",
      required: true,
      before: "Layer opacity",
    },
    {
      name: "iterations",
      type: "number",
      defaultValue: 4,
      min: 0,
      required: true,
      before: "Iterations",
    },
    {
      name: "pre-iterations",
      type: "number",
      defaultValue: 2,
      min: 0,
      required: true,
      before: "Preprocess Iterations",
    },
    {
      name: "base-radius",
      type: "number",
      defaultValue: 16,
      min: 0,
      step: "any",
      required: true,
      before: "Base Radius",
    },
    {
      name: "temperature",
      type: "number",
      defaultValue: 0.7,
      min: 0,
      max: 1,
      step: "any",
      required: true,
      before: "Temperature",
    },
    {
      name: "filter-radius",
      type: "number",
      defaultValue: 32,
      min: 0,
      step: "any",
      required: true,
      before: "Filter Radius",
    },
    {
      name: "filter-weight",
      type: "number",
      defaultValue: 0.5,
      min: 0,
      step: "any",
      required: true,
      before: "Filter Weight",
    },
  ];
  const [colors, setColors] = useState([
    "#ff0000",
    "#ffff00",
    "#00ff00",
    "#00ffff",
    "#0000ff",
    "#ff00ff",
  ]);
  const minDistance = 4;
  const minWidth = 256;
  const minHeight = 256;
  const [width, setWidth] = useState(512);
  const [height, setHeight] = useState(512);
  const [selectedColorIndex, setSelectedColorIndex] = useState(-1);

  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  // const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [resizeMouseDown, setResizeMouseDown] = useState(false);
  const [canvasMouseDown, setCanvasMouseDown] = useState(false);
  const [pending, setPending] = useState(false);
  const [path, setPath] = useState<[number, number][]>([]);
  const pathStr = useMemo(() => {
    const d = path
      .map(([x, y], i) => {
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
    return d && d + " Z";
  }, [path]);

  useEffect(() => {
    if (canvas) {
      clearCanvas(canvas);
    }
  }, [canvas]);
  const [, setHistory] = useReducer(
    (
      state: { history: ImageData[]; index: number },
      action: "push" | "undo" | "redo" | "clear"
    ) => {
      if (!canvas) {
        return state;
      }
      const { history, index: _index } = Object.assign({}, state);
      let index = _index;
      const context = canvas.getContext("2d")!;
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

  const onSubmit = async (form: HTMLFormElement) => {
    if (!canvas) {
      return;
    }
    if (path.length < 2) {
      return;
    }
    const data = parseForm(form);
    const layers = data[":layers"];
    const alpha = data[":alpha"];
    const iterations = data[":iterations"];
    const preIterations = data[":pre-iterations"];
    const baseRadius = data[":base-radius"];
    const temperature = data[":temperature"];
    const filterRadius = data[":filter-radius"];
    const filterWeight = data[":filter-weight"];
    const color = data["$color"];

    if (!color) {
      return "Please select a color.";
    }
    if (layers === undefined || layers <= 0) {
      return "Layers must be a valid positive number.";
    }
    if (alpha === undefined || alpha < 0 || alpha > 1) {
      return "Layer opacity must be a valid number between 0 and 1.";
    }
    if (iterations === undefined || iterations < 0) {
      return "Iterations must be a valid non-negative number.";
    }
    if (preIterations === undefined || preIterations < 0) {
      return "Preprocess iterations must be a valid non-negative number.";
    }
    if (baseRadius === undefined || baseRadius < 0) {
      return "Base radius must be a valid non-negative number.";
    }
    if (temperature === undefined || temperature < 0 || temperature > 1) {
      return "Temperature must be a valid number between 0 and 1.";
    }
    if (filterRadius === undefined || filterRadius < 0) {
      return "Filter radius must be a valid non-negative number.";
    }
    if (filterWeight === undefined || filterWeight < 0) {
      return "Filter weight must be a valid non-negative number.";
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
      filterRadius,
      filterWeight,
      color,
    };

    setPending(true);
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        paintToCanvas(canvas, options);
        resolve();
      }, 0);
    });
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
              onSubmit={async (ev) => {
                ev.preventDefault();
                const message = await onSubmit(ev.currentTarget);
                if (message) {
                  alert(message);
                }
              }}
            >
              {fields.map((attrs, i) => {
                return <FormField key={i} {...attrs} />;
              })}
              <div className="mx-2 my-2">
                <div>
                  <span>Select color</span>
                  <label>
                    <input
                      className="sr-only"
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
                <div className="leading-none">
                  <div className="relative inline-block ml-1 -mr-9 my-1 w-8 h-8">
                    <input
                      className="sr-only left-1/2 bottom-0"
                      name="color"
                      type="radio"
                      checked={false}
                      required
                      onChange={() => {}}
                    />
                  </div>
                  {colors.map((color, i) => {
                    return (
                      <label key={i} className="contents">
                        <div
                          className="
                            relative inline-block mx-1 my-1 w-8 h-8 rounded-md cursor-pointer
                            outline outline-2 outline-gray-300 has-[:checked]:outline-black
                          "
                          style={{ backgroundColor: color }}
                        >
                          <input
                            className="sr-only"
                            name="color"
                            type="radio"
                            value={color}
                            checked={i === selectedColorIndex}
                            required
                            onChange={(ev) => {
                              if (ev.currentTarget.checked) {
                                setSelectedColorIndex(i);
                              }
                            }}
                          />
                        </div>
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
                    disabled:bg-amber-300 disabled:cursor-not-allowed
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
                    disabled:bg-amber-300 disabled:cursor-not-allowed
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
                    if (canvas) {
                      const name = prompt("Enter file name:");
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
              style={{ width, height, pointerEvents: pending ? "none" : undefined }}
            >
              <div className="relative w-full h-full overflow-hidden">
                <canvas ref={setCanvas} className="absolute" />
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
                    className={`${!canvasMouseDown ? "animate-stroke" : ""}`}
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
                    setWidth(Math.floor(Math.max(x, minWidth)));
                    setHeight(Math.floor(Math.max(y, minHeight)));
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
