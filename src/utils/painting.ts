export type LayerOptions = {
  path: [number, number, number][];
  baseRadius: number;
  temperature: number;
  iterations: number;
};

export type LayerListOptions = LayerOptions & {
  layers: number;
  preIterations: number;
};

export type PaintingOptions = LayerListOptions & {
  width: number;
  height: number;
  color: string;
  alpha: number;
};

function uniform(centroid: number, radius: number) {
  return Math.random() * radius * 2 + centroid - radius;
}

function generateLayer({ path, baseRadius, temperature, iterations }: LayerOptions) {
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
}

export function generateLayerList({
  path,
  baseRadius,
  temperature,
  iterations,
  layers,
  preIterations,
}: LayerListOptions) {
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
}
