const http = require("node:http");

const tasks = [];
let nextId = 1;
const maxBodySize = 1024 * 1024;

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(data));
}

async function readJson(request) {
  let body = "";

  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > maxBodySize) {
      const error = new Error("Request body is too large");
      error.statusCode = 413;
      throw error;
    }
  }

  try {
    return JSON.parse(body);
  } catch {
    const error = new Error("Request body must be valid JSON");
    error.statusCode = 400;
    throw error;
  }
}

function validateTask(data, isUpdate = false) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return "Request body must be a JSON object";
  }

  const allowedFields = ["title", "completed"];
  if (Object.keys(data).some((key) => !allowedFields.includes(key))) {
    return "Only title and completed fields are allowed";
  }

  if (!isUpdate || Object.hasOwn(data, "title")) {
    if (typeof data.title !== "string" || data.title.trim() === "") {
      return "title must be a non-empty string";
    }
  }

  if (Object.hasOwn(data, "completed") && typeof data.completed !== "boolean") {
    return "completed must be a boolean";
  }

  if (isUpdate && Object.keys(data).length === 0) {
    return "Provide title or completed to update";
  }

  return null;
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const path = url.pathname;

  if (path === "/api/tasks" && request.method === "GET") {
    sendJson(response, 200, tasks);
    return;
  }

  if (path === "/api/tasks" && request.method === "POST") {
    try {
      const data = await readJson(request);
      const validationError = validateTask(data);
      if (validationError) {
        sendJson(response, 400, { error: validationError });
        return;
      }

      const task = {
        id: nextId++,
        title: data.title.trim(),
        completed: data.completed ?? false,
      };
      tasks.push(task);
      sendJson(response, 201, task);
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message });
    }
    return;
  }

  const taskMatch = path.match(/^\/api\/tasks\/(\d+)$/);
  if (taskMatch) {
    const taskId = Number(taskMatch[1]);
    const taskIndex = tasks.findIndex((task) => task.id === taskId);

    if (taskIndex === -1) {
      sendJson(response, 404, { error: "Task not found" });
      return;
    }

    if (request.method === "GET") {
      sendJson(response, 200, tasks[taskIndex]);
      return;
    }

    if (request.method === "PATCH") {
      try {
        const data = await readJson(request);
        const validationError = validateTask(data, true);
        if (validationError) {
          sendJson(response, 400, { error: validationError });
          return;
        }

        if (Object.hasOwn(data, "title")) {
          tasks[taskIndex].title = data.title.trim();
        }
        if (Object.hasOwn(data, "completed")) {
          tasks[taskIndex].completed = data.completed;
        }
        sendJson(response, 200, tasks[taskIndex]);
      } catch (error) {
        sendJson(response, error.statusCode || 400, { error: error.message });
      }
      return;
    }

    if (request.method === "DELETE") {
      const [deletedTask] = tasks.splice(taskIndex, 1);
      sendJson(response, 200, deletedTask);
      return;
    }
  }

  sendJson(response, 404, { error: "Route not found" });
});

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  server.listen(port, () => {
    console.log(`Task API is running at http://localhost:${port}`);
  });
}

module.exports = { server, tasks };
