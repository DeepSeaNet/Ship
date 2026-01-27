"use client";

import { useState } from "react";
import {
  Button,
  Form,
  Input,
  Label,
  TextField,
  Spinner,
  Checkbox,
} from "@heroui/react";
import { Eye, EyeSlash, ArrowRight } from "@gravity-ui/icons";

interface RegisterFormProps {
  isLoading: boolean;
  onSubmit: (
    username: string,
    email: string,
    password: string,
    confirmPassword: string
  ) => Promise<void>;
}

export function RegisterForm({ isLoading, onSubmit }: RegisterFormProps) {
  const [registerShowPassword, setRegisterShowPassword] = useState(false);
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");

  const handleRegisterSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    if (registerPassword !== registerConfirmPassword) {
      alert("Passwords do not match");
      return;
    }
    await onSubmit(registerUsername, registerEmail, registerPassword, registerConfirmPassword);
  };

  return (
    <Form
      className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300"
      onSubmit={handleRegisterSubmit}
    >
      <TextField
        fullWidth
        isRequired
        name="username"
        type="text"
        value={registerUsername}
        onChange={setRegisterUsername}
      >
        <Label>Username</Label>
        <Input placeholder="username" />
      </TextField>

      <TextField
        fullWidth
        isRequired
        name="email"
        type="email"
        value={registerEmail}
        onChange={setRegisterEmail}
      >
        <Label>Email Address</Label>
        <Input placeholder="you@example.com" />
      </TextField>

      <TextField
        fullWidth
        isRequired
        name="password"
        type={registerShowPassword ? "text" : "password"}
        value={registerPassword}
        onChange={setRegisterPassword}
      >
        <Label>Password</Label>
        <div className="relative">
          <Input placeholder="••••••••" />
          <button
            type="button"
            onClick={() => setRegisterShowPassword(!registerShowPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            {registerShowPassword ? (
              <EyeSlash className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        </div>
      </TextField>

      <TextField
        fullWidth
        isRequired
        name="confirmPassword"
        type={registerShowPassword ? "text" : "password"}
        value={registerConfirmPassword}
        onChange={setRegisterConfirmPassword}
      >
        <Label>Confirm Password</Label>
        <div className="relative">
          <Input placeholder="••••••••" />
        </div>
      </TextField>

      <Checkbox id="terms" name="terms">
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        <Checkbox.Content>
          <Label htmlFor="terms">
            I agree to the Terms of Service and Privacy Policy
          </Label>
        </Checkbox.Content>
      </Checkbox>

      <Button
        fullWidth
        isDisabled={isLoading}
        isPending={isLoading}
        type="submit"
        className="mt-2"
      >
        {isLoading ? (
          <Spinner color="current" size="sm" />
        ) : (
          <>
            Create Account <ArrowRight className="w-4 h-4" />
          </>
        )}
      </Button>
    </Form>
  );
}
