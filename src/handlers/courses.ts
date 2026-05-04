import type { Env } from "../types";
import { jsonResponse, parseJsonBody } from "../utils/http";
import { getAuthedUser } from "../utils/auth";

type CourseRow = {
  id: number;
  title: string;
  owner_user_id: number | null;
  is_system: number;
  created_at: string;
};

type TopicRow = {
  id: number;
  course_id: number;
  title: string;
  sort_order: number;
};

type SubtopicRow = {
  id: number;
  topic_id: number;
  title: string;
  link: string;
  sort_order: number;
};

function isAdminUser(user: { is_admin: number }) {
  return user.is_admin === 1;
}

async function fetchCoursesWithNested(
  env: Env,
  whereClause: string,
  params: unknown[],
) {
  const courses = await env.DB.prepare(
    `SELECT id, title, owner_user_id, is_system, created_at FROM courses ${whereClause} ORDER BY id`,
  )
    .bind(...params)
    .all<CourseRow>();

  const courseRows = courses.results ?? [];
  if (courseRows.length === 0) {
    return [];
  }

  const courseIds = courseRows.map((row) => row.id);
  const topics = await env.DB.prepare(
    `SELECT id, course_id, title, sort_order FROM topics WHERE course_id IN (${courseIds
      .map(() => "?")
      .join(",")}) ORDER BY sort_order ASC, id ASC`,
  )
    .bind(...courseIds)
    .all<TopicRow>();

  const topicRows = topics.results ?? [];
  const topicIds = topicRows.map((row) => row.id);
  const subtopicRows = topicIds.length
    ? ((
        await env.DB.prepare(
          `SELECT id, topic_id, title, link, sort_order FROM subtopics WHERE topic_id IN (${topicIds
            .map(() => "?")
            .join(",")}) ORDER BY sort_order ASC, id ASC`,
        )
          .bind(...topicIds)
          .all<SubtopicRow>()
      ).results ?? [])
    : [];

  const subtopicsByTopic = new Map<number, SubtopicRow[]>();
  for (const subtopic of subtopicRows) {
    const list = subtopicsByTopic.get(subtopic.topic_id) ?? [];
    list.push(subtopic);
    subtopicsByTopic.set(subtopic.topic_id, list);
  }

  const topicsByCourse = new Map<
    number,
    Array<TopicRow & { subtopics: SubtopicRow[] }>
  >();
  for (const topic of topicRows) {
    const list = topicsByCourse.get(topic.course_id) ?? [];
    list.push({
      ...topic,
      subtopics: subtopicsByTopic.get(topic.id) ?? [],
    });
    topicsByCourse.set(topic.course_id, list);
  }

  return courseRows.map((course) => ({
    ...course,
    topics: topicsByCourse.get(course.id) ?? [],
  }));
}

export async function handleGetAdminCourses(env: Env) {
  const courses = await fetchCoursesWithNested(env, "WHERE is_system = 1", []);
  return jsonResponse(200, { courses });
}

export async function handleGetAdminCourse(env: Env, courseId: number) {
  const courses = await fetchCoursesWithNested(
    env,
    "WHERE is_system = 1 AND id = ?",
    [courseId],
  );
  if (!courses.length) {
    return jsonResponse(404, { error: "not_found" });
  }
  return jsonResponse(200, { course: courses[0] });
}

export async function handleGetMyCourses(request: Request, env: Env) {
  const auth = await getAuthedUser(request, env);
  if ("response" in auth) {
    return auth.response;
  }

  const isAdmin = isAdminUser(auth.user);

  const courses = await fetchCoursesWithNested(
    env,
    isAdmin
      ? "WHERE is_system = 1"
      : "WHERE owner_user_id = ? AND is_system = 0",
    isAdmin ? [] : [auth.user.id],
  );
  return jsonResponse(200, { courses });
}

export async function handleCreateMyCourse(request: Request, env: Env) {
  const auth = await getAuthedUser(request, env);
  if ("response" in auth) {
    return auth.response;
  }

  const isAdmin = isAdminUser(auth.user);

  let payload: { title?: string } = {};
  try {
    payload = await parseJsonBody(request);
  } catch {
    return jsonResponse(400, { error: "invalid_json" });
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  if (!title) {
    return jsonResponse(400, { error: "title_required" });
  }

  const created = await env.DB.prepare(
    isAdmin
      ? "INSERT INTO courses (title, owner_user_id, is_system) VALUES (?, NULL, 1) RETURNING id, title, owner_user_id, is_system, created_at"
      : "INSERT INTO courses (title, owner_user_id, is_system) VALUES (?, ?, 0) RETURNING id, title, owner_user_id, is_system, created_at",
  )
    .bind(...(isAdmin ? [title] : [title, auth.user.id]))
    .first<CourseRow>();

  return jsonResponse(201, { course: { ...created, topics: [] } });
}

export async function handleUpdateMyCourse(
  request: Request,
  env: Env,
  courseId: number,
) {
  const auth = await getAuthedUser(request, env);
  if ("response" in auth) {
    return auth.response;
  }

  const isAdmin = isAdminUser(auth.user);

  let payload: { title?: string } = {};
  try {
    payload = await parseJsonBody(request);
  } catch {
    return jsonResponse(400, { error: "invalid_json" });
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  if (!title) {
    return jsonResponse(400, { error: "title_required" });
  }

  const existing = await env.DB.prepare(
    isAdmin
      ? "SELECT id FROM courses WHERE id = ? AND is_system = 1"
      : "SELECT id FROM courses WHERE id = ? AND owner_user_id = ? AND is_system = 0",
  )
    .bind(...(isAdmin ? [courseId] : [courseId, auth.user.id]))
    .first();

  if (!existing) {
    return jsonResponse(404, { error: "not_found" });
  }

  await env.DB.prepare("UPDATE courses SET title = ? WHERE id = ?")
    .bind(title, courseId)
    .run();

  return jsonResponse(200, { ok: true });
}

export async function handleDeleteMyCourse(
  request: Request,
  env: Env,
  courseId: number,
) {
  const auth = await getAuthedUser(request, env);
  if ("response" in auth) {
    return auth.response;
  }

  const isAdmin = isAdminUser(auth.user);

  const existing = await env.DB.prepare(
    isAdmin
      ? "SELECT id FROM courses WHERE id = ? AND is_system = 1"
      : "SELECT id FROM courses WHERE id = ? AND owner_user_id = ? AND is_system = 0",
  )
    .bind(...(isAdmin ? [courseId] : [courseId, auth.user.id]))
    .first();

  if (!existing) {
    return jsonResponse(404, { error: "not_found" });
  }

  await env.DB.prepare("DELETE FROM courses WHERE id = ?").bind(courseId).run();

  return jsonResponse(200, { ok: true });
}

export async function handleAddMyTopic(
  request: Request,
  env: Env,
  courseId: number,
) {
  const auth = await getAuthedUser(request, env);
  if ("response" in auth) {
    return auth.response;
  }

  const isAdmin = isAdminUser(auth.user);

  let payload: { title?: string } = {};
  try {
    payload = await parseJsonBody(request);
  } catch {
    return jsonResponse(400, { error: "invalid_json" });
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  if (!title) {
    return jsonResponse(400, { error: "title_required" });
  }

  const course = await env.DB.prepare(
    isAdmin
      ? "SELECT id FROM courses WHERE id = ? AND is_system = 1"
      : "SELECT id FROM courses WHERE id = ? AND owner_user_id = ? AND is_system = 0",
  )
    .bind(...(isAdmin ? [courseId] : [courseId, auth.user.id]))
    .first();

  if (!course) {
    return jsonResponse(404, { error: "not_found" });
  }

  const nextOrder = await env.DB.prepare(
    "SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM topics WHERE course_id = ?",
  )
    .bind(courseId)
    .first<{ next_order: number }>();

  const created = await env.DB.prepare(
    "INSERT INTO topics (course_id, title, sort_order) VALUES (?, ?, ?) RETURNING id, course_id, title, sort_order",
  )
    .bind(courseId, title, nextOrder?.next_order ?? 1)
    .first<TopicRow>();

  return jsonResponse(201, { topic: { ...created, subtopics: [] } });
}

export async function handleUpdateMyTopic(
  request: Request,
  env: Env,
  topicId: number,
) {
  const auth = await getAuthedUser(request, env);
  if ("response" in auth) {
    return auth.response;
  }

  const isAdmin = isAdminUser(auth.user);

  let payload: { title?: string; sort_order?: number } = {};
  try {
    payload = await parseJsonBody(request);
  } catch {
    return jsonResponse(400, { error: "invalid_json" });
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : null;
  const sortOrder =
    typeof payload.sort_order === "number" ? payload.sort_order : null;

  if (title === null && sortOrder === null) {
    return jsonResponse(400, { error: "no_updates" });
  }

  const topic = await env.DB.prepare(
    isAdmin
      ? "SELECT topics.id FROM topics JOIN courses ON courses.id = topics.course_id WHERE topics.id = ? AND courses.is_system = 1"
      : "SELECT topics.id FROM topics JOIN courses ON courses.id = topics.course_id WHERE topics.id = ? AND courses.owner_user_id = ? AND courses.is_system = 0",
  )
    .bind(...(isAdmin ? [topicId] : [topicId, auth.user.id]))
    .first();

  if (!topic) {
    return jsonResponse(404, { error: "not_found" });
  }

  await env.DB.prepare(
    "UPDATE topics SET title = COALESCE(?, title), sort_order = COALESCE(?, sort_order) WHERE id = ?",
  )
    .bind(title, sortOrder, topicId)
    .run();

  return jsonResponse(200, { ok: true });
}

export async function handleDeleteMyTopic(
  request: Request,
  env: Env,
  topicId: number,
) {
  const auth = await getAuthedUser(request, env);
  if ("response" in auth) {
    return auth.response;
  }

  const isAdmin = isAdminUser(auth.user);

  const existing = await env.DB.prepare(
    isAdmin
      ? "SELECT topics.id FROM topics JOIN courses ON courses.id = topics.course_id WHERE topics.id = ? AND courses.is_system = 1"
      : "SELECT topics.id FROM topics JOIN courses ON courses.id = topics.course_id WHERE topics.id = ? AND courses.owner_user_id = ? AND courses.is_system = 0",
  )
    .bind(...(isAdmin ? [topicId] : [topicId, auth.user.id]))
    .first();

  if (!existing) {
    return jsonResponse(404, { error: "not_found" });
  }

  await env.DB.prepare("DELETE FROM topics WHERE id = ?").bind(topicId).run();

  return jsonResponse(200, { ok: true });
}

export async function handleAddMySubtopic(
  request: Request,
  env: Env,
  topicId: number,
) {
  const auth = await getAuthedUser(request, env);
  if ("response" in auth) {
    return auth.response;
  }

  const isAdmin = isAdminUser(auth.user);

  let payload: { title?: string; link?: string } = {};
  try {
    payload = await parseJsonBody(request);
  } catch {
    return jsonResponse(400, { error: "invalid_json" });
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const link = typeof payload.link === "string" ? payload.link.trim() : "";
  if (!title || !link) {
    return jsonResponse(400, { error: "title_link_required" });
  }

  const topic = await env.DB.prepare(
    isAdmin
      ? "SELECT topics.id FROM topics JOIN courses ON courses.id = topics.course_id WHERE topics.id = ? AND courses.is_system = 1"
      : "SELECT topics.id FROM topics JOIN courses ON courses.id = topics.course_id WHERE topics.id = ? AND courses.owner_user_id = ? AND courses.is_system = 0",
  )
    .bind(...(isAdmin ? [topicId] : [topicId, auth.user.id]))
    .first();

  if (!topic) {
    return jsonResponse(404, { error: "not_found" });
  }

  const nextOrder = await env.DB.prepare(
    "SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM subtopics WHERE topic_id = ?",
  )
    .bind(topicId)
    .first<{ next_order: number }>();

  const created = await env.DB.prepare(
    "INSERT INTO subtopics (topic_id, title, link, sort_order) VALUES (?, ?, ?, ?) RETURNING id, topic_id, title, link, sort_order",
  )
    .bind(topicId, title, link, nextOrder?.next_order ?? 1)
    .first<SubtopicRow>();

  return jsonResponse(201, { subtopic: created });
}

export async function handleUpdateMySubtopic(
  request: Request,
  env: Env,
  subtopicId: number,
) {
  const auth = await getAuthedUser(request, env);
  if ("response" in auth) {
    return auth.response;
  }

  const isAdmin = isAdminUser(auth.user);

  let payload: { title?: string; link?: string; sort_order?: number } = {};
  try {
    payload = await parseJsonBody(request);
  } catch {
    return jsonResponse(400, { error: "invalid_json" });
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : null;
  const link = typeof payload.link === "string" ? payload.link.trim() : null;
  const sortOrder =
    typeof payload.sort_order === "number" ? payload.sort_order : null;

  if (title === null && link === null && sortOrder === null) {
    return jsonResponse(400, { error: "no_updates" });
  }

  const subtopic = await env.DB.prepare(
    isAdmin
      ? "SELECT subtopics.id FROM subtopics JOIN topics ON topics.id = subtopics.topic_id JOIN courses ON courses.id = topics.course_id WHERE subtopics.id = ? AND courses.is_system = 1"
      : "SELECT subtopics.id FROM subtopics JOIN topics ON topics.id = subtopics.topic_id JOIN courses ON courses.id = topics.course_id WHERE subtopics.id = ? AND courses.owner_user_id = ? AND courses.is_system = 0",
  )
    .bind(...(isAdmin ? [subtopicId] : [subtopicId, auth.user.id]))
    .first();

  if (!subtopic) {
    return jsonResponse(404, { error: "not_found" });
  }

  await env.DB.prepare(
    "UPDATE subtopics SET title = COALESCE(?, title), link = COALESCE(?, link), sort_order = COALESCE(?, sort_order) WHERE id = ?",
  )
    .bind(title, link, sortOrder, subtopicId)
    .run();

  return jsonResponse(200, { ok: true });
}

export async function handleDeleteMySubtopic(
  request: Request,
  env: Env,
  subtopicId: number,
) {
  const auth = await getAuthedUser(request, env);
  if ("response" in auth) {
    return auth.response;
  }

  const isAdmin = isAdminUser(auth.user);

  const existing = await env.DB.prepare(
    isAdmin
      ? "SELECT subtopics.id FROM subtopics JOIN topics ON topics.id = subtopics.topic_id JOIN courses ON courses.id = topics.course_id WHERE subtopics.id = ? AND courses.is_system = 1"
      : "SELECT subtopics.id FROM subtopics JOIN topics ON topics.id = subtopics.topic_id JOIN courses ON courses.id = topics.course_id WHERE subtopics.id = ? AND courses.owner_user_id = ? AND courses.is_system = 0",
  )
    .bind(...(isAdmin ? [subtopicId] : [subtopicId, auth.user.id]))
    .first();

  if (!existing) {
    return jsonResponse(404, { error: "not_found" });
  }

  await env.DB.prepare("DELETE FROM subtopics WHERE id = ?")
    .bind(subtopicId)
    .run();

  return jsonResponse(200, { ok: true });
}
