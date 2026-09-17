import { z } from "../schema";

export const signInInputSchema = z.object({
  email: z.string().trim().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
  keepSignedIn: z.boolean().default(true),
});

export const signUpInputSchema = z
  .object({
    fullName: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
    email: z.string().trim().email("Invalid email").max(255),
    password: z.string().min(6, "Password must be at least 6 characters").max(128),
    confirmPassword: z.string(),
    keepSignedIn: z.boolean().default(true),
  })
  .refine((input) => input.password === input.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignInInput = z.infer<typeof signInInputSchema>;
export type SignUpInput = z.infer<typeof signUpInputSchema>;
