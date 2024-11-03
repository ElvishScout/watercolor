export function parseForm(form: HTMLFormElement) {
  const formData = new FormData(form);

  return new Proxy<{
    [key: `:${string}`]: number | undefined;
    [key: `$${string}`]: string | undefined;
    [key: `?${string}`]: boolean | undefined;
    [key: `#${string}`]: File | undefined;
  }>(
    {},
    {
      get(_, p) {
        const key = p.toString();
        const identifier = key[0];
        const name = key.substring(1);
        const data = formData.get(name);

        if (data === null) {
          return undefined;
        }
        if (data instanceof File) {
          if (identifier === "#") {
            return data;
          }
          return undefined;
        }
        switch (identifier) {
          case ":":
            if (data) {
              return parseFloat(data);
            }
            return undefined;
          case "$":
            return data;
          case "?":
            return data === "on";
        }
        return undefined;
      },
    }
  );
}
