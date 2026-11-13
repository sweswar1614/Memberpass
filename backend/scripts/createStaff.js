require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");

async function createStaff() {
  try {
    await connectDB();

    let staff = await User.findOne({
      email: "m2.staff@example.com"
    });

    if (!staff) {
      staff = new User({
        name: "MemberPass Staff",
        email: "m2.staff@example.com",
        password: "MemberPass@123",
        phone: "9876500099",
        role: "staff",
        isActive: true
      });
    } else {
      staff.name = "MemberPass Staff";
      staff.password = "MemberPass@123";
      staff.role = "staff";
      staff.isActive = true;
    }

    await staff.save();

    console.log("Staff account created/updated successfully!");
    console.log("Email:", staff.email);
    console.log("Role:", staff.role);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Staff creation failed:", error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

createStaff();
