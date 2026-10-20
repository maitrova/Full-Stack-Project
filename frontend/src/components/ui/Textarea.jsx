import { useId } from "react";
import cx from "./cx.js";
import { errorClasses, fieldClasses, hintClasses, labelClasses } from "./fieldStyles.js";

/** Multi-line text field with optional label, hint and error message. */
const Textarea = ({ label, hint, error, id, rows = 4, className, textareaClassName, ...rest }) => {
  const autoId = useId();
  const textareaId = id || autoId;
  const describedBy = error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined;

  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={textareaId} className={labelClasses}>
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        rows={rows}
        className={fieldClasses(Boolean(error), cx("py-3 leading-relaxed", textareaClassName))}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {error ? (
        <p id={`${textareaId}-error`} className={errorClasses}>
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${textareaId}-hint`} className={hintClasses}>
            {hint}
          </p>
        )
      )}
    </div>
  );
};

export default Textarea;
