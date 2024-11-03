import { useEffect, useMemo, useRef, useState } from "react";
import { parseForm } from "./utils/form-parser";

type LayerOptions = {
  path: [number, number, number][];
  baseRadius: number;
  temperature: number;
  iterations: number;
};

type PaintingOptions = LayerOptions & {
  color: string;
  alpha: number;
  layers: number;
  preIterations: number;
};

const distance = ([x1, y1]: [number, number], [x2, y2]: [number, number]) => {
  return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
};

const uniform = (centroid: number, radius: number) => {
  return Math.random() * radius * 2 + centroid - radius;
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

const generateLayer = ({ path, baseRadius, temperature, iterations }: LayerOptions) => {
  let currPath: [number, number, number][] = path;
  for (let i = 0; i < iterations; i++) {
    const nextPath: [number, number, number][] = [];
    for (let j = 0; j < currPath.length; j++) {
      const [x1, y1, r1] = currPath[(j || currPath.length) - 1];
      const [x2, y2, r2] = currPath[j];
      const rm = ((r1 + r2) * temperature) / 2;
      const pm: [number, number, number] = [
        uniform((x1 + x2) / 2, baseRadius * rm),
        uniform((y1 + y2) / 2, baseRadius * rm),
        rm,
      ];
      nextPath.push(pm, [x2, y2, r2]);
    }
    currPath = nextPath;
  }
  return currPath;
};

const initCanvas = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#ffffff";
  context.globalAlpha = 1;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillRect(0, 0, canvas.width, canvas.height);
  // context.globalCompositeOperation = "source-over";
};

const drawPainting = (
  canvas: HTMLCanvasElement,
  {
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
  context.fillStyle = color;
  context.globalAlpha = alpha;

  const basePath = generateLayer({
    path,
    baseRadius,
    temperature,
    iterations: preIterations,
  });

  for (let i = 0; i < layers; i++) {
    context.beginPath();
    const layerPath = generateLayer({
      path: basePath,
      baseRadius,
      temperature,
      iterations,
    });
    layerPath.forEach(([x, y], i) => {
      if (i) {
        context.lineTo(x, y);
      } else {
        context.moveTo(x, y);
      }
    });
    context.closePath();
    context.fill("evenodd");
  }
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

  const [selectedColorIndex, setSelectedColorIndex] = useState(0);

  const [resizeMouseDown, setResizeMouseDown] = useState(false);
  const [width, setWidth] = useState(320);
  const [height, setHeight] = useState(320);

  const [canvasMouseDown, setCanvasMouseDown] = useState(false);
  const [path, setPath] = useState<[number, number][]>([]);

  const pathStr = useMemo(() => {
    const d = path
      .map(([x, y], i) => {
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
    return d && d + " Z";
  }, [path]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      initCanvas(canvas);
    }
  }, [canvasRef]);

  const onSubmit = (form: HTMLFormElement) => {
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
    if (temperature === undefined || temperature < 0) {
      errorMessages.push("Temperature must be a valid non-negative number.");
    }

    if (errorMessages.length) {
      alert(errorMessages.join("\n"));
      return;
    }

    const options = {
      path: randomizePath(path),
      layers,
      alpha,
      iterations,
      preIterations,
      baseRadius,
      temperature,
      color,
    } as PaintingOptions;

    drawPainting(canvas, options);
    setPath([]);
  };

  return (
    <>
      <div className="absolute p-4 left-0 top-0 w-full h-full">
        <div className="w-full h-full">
          <div className="inline-block w-1/4 align-top">
            <form
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
                      onBlur={(ev) => {
                        const inputColor = ev.currentTarget.value;
                        if (colors.indexOf(inputColor) === -1) {
                          setColors([...colors, inputColor]);
                        }
                      }}
                    />
                    <span className="mx-1 text-blue-500 cursor-pointer select-none">Add</span>
                  </label>
                  <span
                    className="mx-1 text-red-500 cursor-pointer select-none"
                    onClick={() => {
                      setColors(colors.filter((_, i) => i !== selectedColorIndex));
                    }}
                  >
                    Remove
                  </span>
                </div>
                <div className="my-1 leading-none select-none">
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
                    mx-1 py-0.5 w-16 rounded-md text-white
                    bg-blue-500 hover:bg-blue-400 active:bg-blue-300
                  "
                  type="submit"
                >
                  Draw
                </button>
                <button
                  className="
                    mx-1 py-0.5 w-16 rounded-md text-white
                    bg-red-500 hover:bg-red-400 active:bg-red-300
                  "
                  type="button"
                  onClick={() => {
                    const canvas = canvasRef.current;
                    if (canvas) {
                      initCanvas(canvas);
                    }
                  }}
                >
                  Clear
                </button>
              </div>
            </form>
          </div>
          <div className="inline-block w-3/4 align-top">
            <div className="relative outline outline-black outline-2" style={{ width, height }}>
              <canvas ref={canvasRef} className="absolute" width={width} height={height} />
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
                  fill="none"
                />
              </svg>
              <div
                className="
                  absolute w-4 h-4 -right-2 -bottom-2 border-2 bg-white
                  border-black cursor-nwse-resize z-20
                "
                onPointerDown={(ev) => {
                  setResizeMouseDown(true);
                  ev.currentTarget.setPointerCapture(ev.pointerId);
                }}
                onPointerMove={(ev) => {
                  if (resizeMouseDown) {
                    const rect = ev.currentTarget.parentElement!.getBoundingClientRect();
                    const [x, y] = [ev.clientX - rect.left, ev.clientY - rect.top];
                    setWidth(x);
                    setHeight(y);
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
