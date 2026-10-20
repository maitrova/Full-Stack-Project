import { useId } from "react";
import { ChevronDown } from "lucide-react";
import cx from "./cx.js";
import { errorClasses, fieldClasses, hintClasses, labelClasses } from "./fieldStyles.js";

/**
 * Native select styled for the dark theme.
 * `options`: [{ value, label, disabled }] — or pass <option> children instead.
 */
const Select = ({
  label,
  hint,
  error,
  id,
  options,
  placeholder,
  className,
  selectClassName,
  children,
  ...rest
}) => {
  const autoId = useId();
  const selectId = id || autoId;
  const describedBy = error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined;

  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={selectId} className={labelClasses}>
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          className={fieldClasses(Boolean(error), cx("h-11 appearance-none pr-10", selectClassName))}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options
            ? options.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))
            : children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mt-muted"
          aria-hidden="true"
        />
      </div>
      {error ? (
        <p id={`${selectId}-error`} className={errorClasses}>
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${selectId}-hint`} className={hintClasses}>
            {hint}
          </p>
        )
      )}
    </div>
  );
};

export default Select;
