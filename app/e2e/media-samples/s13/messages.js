// Sample code for an Unvibe demo. Not from a real project.
const express = require("express");
const { db } = require("../db");
const { requireLogin } = require("../auth");

const router = express.Router();

router.get("/api/profile", requireLogin, async (req, res) => {
  res.json(await db.users.findById(req.user.id));
});

router.get("/api/messages", async (req, res) => {
  res.json(await db.messages.findAll());
});

module.exports = router;
