import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { ALL_ROLES, type Role } from "../types/roles";

export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
  tenantId: Types.ObjectId;
  isActive: boolean;
  lastLoginAt?: Date;
  refreshTokenHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    role: {
      type: String,
      enum: ALL_ROLES,
      default: "staff",
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: Date,
    refreshTokenHash: {
      type: String,
      select: false,
    },
  },
  { timestamps: true }
);

userSchema.index({ tenantId: 1, email: 1 });
userSchema.index({ tenantId: 1, role: 1 });

userSchema.virtual("fullName").get(function (this: IUser) {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.set("toJSON", {
  virtuals: true,
  transform(_doc, ret) {
    delete ret.password;
    delete ret.refreshTokenHash;
    delete ret.__v;
    return ret;
  },
});

export const User: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", userSchema);
