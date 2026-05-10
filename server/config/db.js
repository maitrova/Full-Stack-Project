import mongoose from "mongoose";
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGOOSE_URL);
    console.log(`MongoDB Connected: ${conn.connection.host}`);

  } catch (error) {
    console.error("MongoDB connection failed:");
console.error("Name:", error.name);
console.error("Message:", error.message);
console.error("Code:", error.code);
console.error("Stack:", error.stack);

    process.exit(1);
  }
};

export default connectDB;