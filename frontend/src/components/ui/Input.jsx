import { useId } from "react";
import cx from "./cx.js";
import { errorClasses, fieldClasses, hintClasses, labelClasses } from "./fieldStyles.js";

/** Text input with optional label, hint and error message. */
const Input = ({ label, hint, error, id, className, inputClassName, ...rest }) => {
  const autoId = useId();
  const inputId = id || autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={inputId} className={labelClasses}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={fieldClasses(Boolean(error), cx("h-11", inputClassName))}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-error`} className={errorClasses}>
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${inputId}-hint`} className={hintClasses}>
            {hint}
          </p>
        )
      )}
    </div>
  );
};

export default Input;
