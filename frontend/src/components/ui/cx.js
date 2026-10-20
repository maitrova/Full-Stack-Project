// Joins class names, skipping falsy values: cx("a", cond && "b") -> "a b"
const cx = (...classes) => classes.filter(Boolean).join(" ");

export default cx;
