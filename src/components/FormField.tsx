export default function FormField({
  before,
  after,
  ...attrs
}: {
  before?: React.ReactNode;
  after?: React.ReactNode;
  onChange?: (value: string) => void;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="mx-2 my-2">
      <label>
        {before !== undefined && <span>{before}</span>}
        <input
          className="
            w-24 mx-2 px-2 border-b-2 text-center border-gray-400
            focus:outline-none focus:border-blue-500 transition-colors
            spin-button-none
          "
          {...attrs}
        />
        {after !== undefined && <span>{after}</span>}
      </label>
    </div>
  );
}
