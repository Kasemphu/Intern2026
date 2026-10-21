const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const { server, tasks } = require("./server");

let baseUrl;

before(async () => {
  tasks.length = 0;
  const address = await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address()));
  });
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("supports task CRUD and validates input", async () => {
  let response = await fetch(`${baseUrl}/api/tasks`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), []);

  response = await fetch(`${baseUrl}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "  Learn Node.js  " }),
  });
  assert.equal(response.status, 201);
  const createdTask = await response.json();
  assert.deepEqual(createdTask, { id: 1, title: "Learn Node.js", completed: false });

  response = await fetch(`${baseUrl}/api/tasks/${createdTask.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completed: true }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ...createdTask, completed: true });

  response = await fetch(`${baseUrl}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: " " }),
  });
  assert.equal(response.status, 400);

  response = await fetch(`${baseUrl}/api/tasks/${createdTask.id}`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ...createdTask, completed: true });

  response = await fetch(`${baseUrl}/api/tasks/${createdTask.id}`, {
    method: "DELETE",
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ...createdTask, completed: true });

  response = await fetch(`${baseUrl}/api/tasks/${createdTask.id}`);
  assert.equal(response.status, 404);
});
