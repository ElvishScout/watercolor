import glur from "glur/mono16";

export type PathOptions = {
  path: [number, number, number][];
  baseRadius: number;
  temperature: number;
  iterations: number;
};

export type PathListOptions = PathOptions & {
  layers: number;
  preIterations: number;
};

export type FilterOptions = {
  width: number;
  height: number;
  color: string;
  filterRadius: number;
  filterWeight: number;
};

export type PaintingOptions = PathListOptions &
  FilterOptions & {
    width: number;
    height: number;
    color: string;
    alpha: number;
  };

const uniform = (centroid: number, radius: number) => {
  return Math.random() * radius * 2 + centroid - radius;
};

const generateLayer = ({ path, baseRadius, temperature, iterations }: PathOptions) => {
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

const generatePathList = ({
  path,
  baseRadius,
  temperature,
  iterations,
  layers,
  preIterations,
}: PathListOptions) => {
  const basePath = generateLayer({
    path,
    baseRadius,
    temperature,
    iterations: preIterations,
  });
  const layerList = Array.from({ length: layers }, () =>
    generateLayer({
      path: basePath,
      baseRadius,
      temperature,
      iterations,
    })
  );
  return layerList;
};

export const clearCanvas = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#ffffff";
  context.globalAlpha = 1;
  context.fillRect(0, 0, canvas.width, canvas.height);
};

const generateFilterCanvas = ({
  width,
  height,
  color,
  filterRadius,
  filterWeight,
}: FilterOptions) => {
  const weight = Math.pow(filterRadius, 1.5) * filterWeight;
  const padding = filterRadius * 3;
  const blurWidth = width + padding * 2;
  const blurHeight = height + padding * 2;

  const u16array = Uint16Array.from(
    { length: blurWidth * blurHeight },
    () => Math.random() * 65536
  );
  glur(u16array, blurWidth, blurHeight, filterRadius);

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  canvas.width = width;
  canvas.height = height;
  context.fillStyle = color;
  context.fillRect(0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      const u16 = u16array[(i + padding) * blurWidth + j + padding];
      const alpha = 255 + Math.min(0, (u16 / 256 - 128) * weight);
      imageData.data[(i * width + j) * 4 + 3] = alpha;
    }
  }
  context.putImageData(imageData, 0, 0);
  return canvas;
};

const generatePaintedCanvas = ({
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
  filterRadius,
  filterWeight,
}: PaintingOptions) => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  canvas.width = width;
  canvas.height = height;
  context.fillStyle = color;
  context.globalAlpha = alpha;

  const layerList = generatePathList({
    path,
    baseRadius,
    temperature,
    iterations,
    layers,
    preIterations,
  });
  layerList.forEach((layerPath) => {
    context.beginPath();
    layerPath.forEach(([x, y], i) => {
      if (i) {
        context.lineTo(x, y);
      } else {
        context.moveTo(x, y);
      }
    });
    context.closePath();
    context.fill("evenodd");
  });
  if (filterRadius && filterWeight) {
    const filter = generateFilterCanvas({
      width,
      height,
      color,
      filterRadius,
      filterWeight,
    });
    context.globalCompositeOperation = "source-in";
    context.globalAlpha = 1;
    context.drawImage(filter, 0, 0);
  }
  return canvas;
};

export const paintToCanvas = (canvas: HTMLCanvasElement, options: PaintingOptions) => {
  const { width, height } = options;
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
  const topCanvas = generatePaintedCanvas(options);
  context.drawImage(topCanvas, 0, 0);
};
