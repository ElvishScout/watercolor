import { useMemo, useState } from "react";

function distance([x1, y1]: [number, number], [x2, y2]: [number, number]) {
  return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

function gaussian(mean: number = 0, stdev: number = 1) {
  const u = 1 - Math.random(); // Converting [0,1) to (0,1]
  const v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdev + mean;
}

function generateLayer(path: [number, number][], iterations: number) {
  let currPath: [number, number][] = path;
  for (let i = 0; i < iterations; i++) {
    const nextPath = [];
    for (let j = 0; j < currPath.length; j++) {
      const p1 = currPath[(j || currPath.length) - 1];
      const p2 = currPath[j];
      const pm: [number, number] = [
        gaussian((p1[0] + p2[0]) / 2, 16),
        gaussian((p1[1] + p2[1]) / 2, 16),
      ];
      nextPath.push(pm, p2);
    }
    currPath = nextPath;
  }
  return currPath;
}

function generateCanvas({
  width,
  height,
  layers,
  fill,
  path,
}: {
  width: number;
  height: number;
  layers: number;
  fill: string;
  path: [number, number][];
}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  context.fillStyle = fill;
  context.globalAlpha = 2 / layers;

  for (let i = 0; i < layers; i++) {
    context.beginPath();
    const layerPath = generateLayer(path, 4);
    layerPath.forEach(([x, y], i) => {
      if (i) {
        context.lineTo(x, y);
      } else {
        context.moveTo(x, y);
      }
      console.log([x, y]);
    });
    context.closePath();
    context.fill();
  }

  return canvas;
}

function App() {
  const minDistance = 32;

  const [width] = useState(800);
  const [height] = useState(600);

  const [mouseDown, setMouseDown] = useState(false);
  const [path, setPath] = useState<[number, number][]>([]);
  const pathStr = useMemo(() => {
    const d = path
      .map(([x, y], i) => {
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
    return d && d + " Z";
  }, [path]);
  const [imageSrc, setImageSrc] = useState("");

  return (
    <>
      <div className="w-fit h-fit border-black border-2">
        <div
          className="absolute pointer-events-none"
          style={{ width, height, backgroundImage: `url(${imageSrc})` }}
        ></div>
        <svg
          className="cursor-crosshair"
          width={width}
          height={height}
          onMouseDown={(ev) => {
            setMouseDown(true);
            setPath([[ev.clientX, ev.clientY]]);
          }}
          onMouseMove={(ev) => {
            const point: [number, number] = [ev.clientX, ev.clientY];
            if (
              mouseDown &&
              (!path.length || distance(path[path.length - 1], point) > minDistance)
            ) {
              setPath([...path, point]);
            }
          }}
          onMouseUp={() => {
            setMouseDown(false);
            const closingPath: [number, number][] = [];
            const p0 = path[0];
            const pn = path[path.length - 1];
            const dist = distance(p0, pn);
            const n = Math.floor(dist / minDistance);
            for (let i = 1; i < n; i++) {
              const pm: [number, number] = [
                pn[0] + ((p0[0] - pn[0]) * i) / n,
                pn[1] + ((p0[1] - pn[1]) * i) / n,
              ];
              closingPath.push(pm);
            }
            setPath([...path, ...closingPath]);
          }}
        >
          <path d={pathStr} stroke="#000000" strokeWidth={1} strokeDasharray="4 4" fill="none" />
        </svg>
      </div>
      <button
        onClick={() => {
          const canvas = generateCanvas({ width, height, path, layers: 128, fill: "#ff0000" });
          setImageSrc(canvas.toDataURL());
          setPath([]);
        }}
      >
        Draw
      </button>
    </>
  );
}

export default App;
