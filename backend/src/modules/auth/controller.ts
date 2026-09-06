import { Request, Response, NextFunction } from "express";
import * as authService from "./service";
import { env } from "../../config/env";

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.registerCandidate(req.body);
    res.status(201).json({ data: user });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.login(
      req.body,
      req.headers["user-agent"],
      req.ip
    );

    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth/refresh",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const oldToken = req.cookies?.refreshToken;

    if (!oldToken) {
      res.status(401).json({
        error: { code: "AUTH_NO_REFRESH", message: "No refresh token provided" },
      });
      return;
    }

    const result = await authService.refreshSession(oldToken);

    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth/refresh",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ data: { accessToken: result.accessToken } });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const refreshToken = req.cookies?.refreshToken;
    await authService.logout(req.user!.userId, refreshToken);

    res.clearCookie("refreshToken", { path: "/api/auth/refresh" });
    res.json({ data: { message: "Logged out successfully" } });
  } catch (err) {
    next(err);
  }
}

export async function setupTotp(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.setupTotp(req.user!.userId);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function createAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.createAdmin(req.body);
    res.status(201).json({ data: user });
  } catch (err) {
    next(err);
  }
}
