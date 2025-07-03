const bcrypt = require('bcryptjs');

bcrypt.hash('Admin@attendance', 10).then(hash => {
  console.log("Hashed password:", hash);
});
