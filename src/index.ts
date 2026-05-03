import type { Env } from "./types";
import { handleOptions, getPathParts, jsonResponse } from "./utils/http";
import { handleGetMe, handlePatchMe } from "./handlers/me";
import {
  handleGetMyProgress,
  handleUpdateMyProgress,
} from "./handlers/progress";
import {
  handleAddMySubtopic,
  handleAddMyTopic,
  handleCreateMyCourse,
  handleDeleteMySubtopic,
  handleGetAdminCourse,
  handleGetAdminCourses,
  handleGetMyCourses,
  handleUpdateMyCourse,
  handleUpdateMySubtopic,
  handleUpdateMyTopic,
} from "./handlers/courses";

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const parts = getPathParts(url.pathname);

    if (request.method === "OPTIONS") {
      return handleOptions();
    }

    if (url.pathname === "/api/health") {
      return jsonResponse(200, { ok: true });
    }

    if (url.pathname === "/api/login" && request.method === "GET") {
      return new Response(null, {
        status: 302,
        headers: { Location: "https://ds-frontend-e9s.pages.dev/edit-courses" },
      });
    }

    if (url.pathname === "/api/me" && request.method === "GET") {
      return handleGetMe(request, env);
    }

    if (url.pathname === "/api/me" && request.method === "PATCH") {
      return handlePatchMe(request, env);
    }

    if (url.pathname === "/api/courses" && request.method === "GET") {
      return handleGetAdminCourses(env);
    }

    if (parts.length === 3 && parts[0] === "api" && parts[1] === "courses") {
      const courseId = Number(parts[2]);
      if (!Number.isNaN(courseId) && request.method === "GET") {
        return handleGetAdminCourse(env, courseId);
      }
    }

    if (url.pathname === "/api/my/courses" && request.method === "GET") {
      return handleGetMyCourses(request, env);
    }

    if (url.pathname === "/api/my/progress" && request.method === "GET") {
      return handleGetMyProgress(request, env);
    }

    if (url.pathname === "/api/my/courses" && request.method === "POST") {
      return handleCreateMyCourse(request, env);
    }

    if (
      parts.length === 4 &&
      parts[0] === "api" &&
      parts[1] === "my" &&
      parts[2] === "courses"
    ) {
      const courseId = Number(parts[3]);
      if (!Number.isNaN(courseId) && request.method === "PATCH") {
        return handleUpdateMyCourse(request, env, courseId);
      }
    }

    if (
      parts.length === 5 &&
      parts[0] === "api" &&
      parts[1] === "my" &&
      parts[2] === "courses" &&
      parts[4] === "topics"
    ) {
      const courseId = Number(parts[3]);
      if (!Number.isNaN(courseId) && request.method === "POST") {
        return handleAddMyTopic(request, env, courseId);
      }
    }

    if (
      parts.length === 4 &&
      parts[0] === "api" &&
      parts[1] === "my" &&
      parts[2] === "topics"
    ) {
      const topicId = Number(parts[3]);
      if (!Number.isNaN(topicId) && request.method === "PATCH") {
        return handleUpdateMyTopic(request, env, topicId);
      }
    }

    if (
      parts.length === 5 &&
      parts[0] === "api" &&
      parts[1] === "my" &&
      parts[2] === "topics" &&
      parts[4] === "subtopics"
    ) {
      const topicId = Number(parts[3]);
      if (!Number.isNaN(topicId) && request.method === "POST") {
        return handleAddMySubtopic(request, env, topicId);
      }
    }

    if (
      parts.length === 4 &&
      parts[0] === "api" &&
      parts[1] === "my" &&
      parts[2] === "subtopics"
    ) {
      const subtopicId = Number(parts[3]);
      if (!Number.isNaN(subtopicId) && request.method === "PATCH") {
        return handleUpdateMySubtopic(request, env, subtopicId);
      }
      if (!Number.isNaN(subtopicId) && request.method === "DELETE") {
        return handleDeleteMySubtopic(request, env, subtopicId);
      }
    }

    if (
      parts.length === 4 &&
      parts[0] === "api" &&
      parts[1] === "my" &&
      parts[2] === "progress"
    ) {
      const subtopicId = Number(parts[3]);
      if (!Number.isNaN(subtopicId) && request.method === "PUT") {
        return handleUpdateMyProgress(request, env, subtopicId);
      }
    }

    return jsonResponse(404, { error: "not_found" });
  },
};
