/* eslint-disable no-restricted-syntax */
/* eslint-disable no-undef */
/* eslint-disable max-len */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable no-unused-vars */
const Hapi = require('@hapi/hapi');
const Joi = require('joi'); // Diperlukan untuk validasi data
const uuid = require('uuid');
const mysql = require('mysql'); // Digunakan untuk membuat UUID

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'apiresto1',
});
// Fungsi helper untuk menjalankan query dengan promise
// function query(sql) {
//   return new Promise((resolve, reject) => {
//     connection.query(sql, (error, results) => {
//       if (error) {
//         reject(error);
//         return;
//       }
//       resolve(results);
//     });
//   });
// }
// Inisialisasi koneksi database
connection.connect((err) => {
  if (err) {
    console.error(`Error connecting to database: ${err.stack}`);
    return;
  }
  console.log(`Connected to database with ID: ${connection.threadId}`);
});

const init = async () => {
  const server = Hapi.server({
    port: process.env.PORT || 3014,
    host: '0.0.0.0',
  });

  server.route({
    method: 'GET',
    path: '/list',
    handler: async (request, h) => {
      try {
        const restaurantss = await new Promise((resolve, reject) => {
          connection.query('SELECT * FROM restaurants', (error, results, fields) => {
            if (error) {
              reject(error);
            } else {
              resolve(results);
            }
          });
        });

        return h.response({
          error: false,
          message: 'success',
          restaurants: restaurantss,
        });
      } catch (error) {
        console.error(`Error fetching restaurants: ${error.stack}`);
        return h.response({ error: true, message: 'Failed to fetch restaurants' }).code(500);
      }
    },
    options: {
      cors: {
        origin: ['*'],
      },
    },
  });
  server.route({
    method: 'GET',
    path: '/detail/{id}',
    handler: async (request, h) => {
      try {
        const { id } = request.params;

        const restaurant = await new Promise((resolve, reject) => {
          connection.query('SELECT * FROM restaurants WHERE id = ?', [id], (error, results, fields) => {
            if (error) {
              reject(error);
            } else {
              resolve(results[0]);
            }
          });
        });

        if (!restaurant) {
          return h.response({ error: true, message: 'Restaurant not found' }).code(404);
        }

        const detailedRestaurant = {
          ...restaurant,
          customerReviews: await new Promise((resolve, reject) => {
            connection.query('SELECT * FROM customerReviews WHERE id = ?', [id], (error, results, fields) => {
              if (error) {
                reject(error);
              } else {
                resolve(results);
              }
            });
          }),
        };

        return h.response({
          error: false,
          message: 'success',
          restaurant: detailedRestaurant,
        });
      } catch (error) {
        console.error(`Error fetching restaurant details: ${error.stack}`);
        return h.response({ error: true, message: 'Failed to fetch restaurant details' }).code(500);
      }
    },
    options: {
      cors: {
        origin: ['*'],
      },
    },
  });

  server.route({
    method: 'POST',
    path: '/restaurants',
    handler: async (request, h) => {
      try {
        const {
          name, description, city, address, pictureId, rating,
        } = request.payload;
        const id = uuid.v4();
        await connection.query(
          'INSERT INTO restaurants (id, name, description, city, address, pictureId, rating) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, name, description, city, address, pictureId, rating],
        );
        return {
          error: false,
          message: 'Restaurant added successfully',
          restaurant: {
            id, name, description, city, address, pictureId, rating,
          },
        };
      } catch (error) {
        console.error(`Error adding restaurant: ${error.stack}`);
        return h.response({ error: true, message: 'Failed to add restaurant' }).code(500);
      }
    },
    options: {
      validate: {
        payload: Joi.object({
          name: Joi.string().required(),
          description: Joi.string().required(),
          city: Joi.string().required(),
          address: Joi.string().required(),
          pictureId: Joi.string().required(),
          rating: Joi.number().required(),
        }),
      },
      cors: {
        origin: ['*'],
      },
    },
  });

  server.route({
    method: 'DELETE',
    path: '/restaurants/{id}',
    handler: async (request, h) => {
      try {
        const { id } = request.params;
        await connection.query('DELETE FROM restaurants WHERE id = ?', [id]);
        return { error: false, message: 'Restaurant deleted successfully' };
      } catch (error) {
        console.error(`Error deleting restaurant: ${error.stack}`);
        return h.response({ error: true, message: 'Failed to delete restaurant' }).code(500);
      }
    },
    options: {
      cors: {
        origin: ['*'],
      },
    },
  });

  server.route({
    method: 'PUT',
    path: '/restaurants/{id}',
    handler: async (request, h) => {
      try {
        const { id } = request.params;
        const {
          name, description, city, address, pictureId, rating,
        } = request.payload;
        await connection.query(
          'UPDATE restaurants SET name = ?, description = ?, city = ?, address = ?, pictureId = ?, rating = ? WHERE id = ?',
          [name, description, city, address, pictureId, rating, id],
        );
        return {
          error: false,
          message: 'Restaurant updated successfully',
          restaurant: {
            id, name, description, city, address, pictureId, rating,
          },
        };
      } catch (error) {
        console.error(`Error updating restaurant: ${error.stack}`);
        return h.response({ error: true, message: 'Failed to update restaurant' }).code(500);
      }
    },
    options: {
      validate: {
        payload: Joi.object({
          name: Joi.string().required(),
          description: Joi.string().required(),
          city: Joi.string().required(),
          address: Joi.string().required(),
          pictureId: Joi.string().required(),
          rating: Joi.number().required(),
        }),
      },
      cors: {
        origin: ['*'],
      },
    },
  });

  server.route({
    method: 'POST',
    path: '/review',
    handler: async (request, h) => {
      try {
        const { id, name, review } = request.payload;
        // const id = uuid.v4();
        const restaurantDetail = await connection.query(
          'SELECT id FROM restaurants WHERE id = ?',
          [id],
        );
        if (restaurantDetail.length === 0) {
          return h.response({ error: true, message: 'Restaurant not found' }).code(404);
        }
        await connection.query(
          'INSERT INTO customerReviews (id, name, review, date) VALUES (?, ?, ?, NOW())',
          [id, name, review],
        );

        return {
          error: false,
          message: 'Customer review added successfully',
          review: {
            id,
            name,
            review,
            date: new Date().toISOString(),
          },
        };
      } catch (error) {
        console.error(`Error adding customer review: ${error.stack}`);
        return h.response({ error: true, message: 'Failed to add customer review' }).code(500);
      }
    },
    options: {
      validate: {
        payload: Joi.object({
          id: Joi.string().required(),
          name: Joi.string().required(),
          review: Joi.string().required(),
        }),
      },
      cors: {
        origin: ['*'],
      },
    },
  });

  server.route({
    method: 'GET',
    path: '/',
    handler: (request, h) => {
      const { pictureId } = request.params;

      const query = 'SELECT image FROM pictures WHERE pictureId = ?';
      connection.query(query, [pictureId], (error, results) => {
        if (error) throw error;

        if (results.length === 0) {
          return h.response({ error: 'Image not found' }).code(404);
        }

        const imageBuffer = results[0].image;

        return h.response(imageBuffer)
          .type('image/jpeg')
          .header('Content-Disposition', `inline; filename="${pictureId}.jpg"`);
      });

      return h.response().code(200);
    },
  });
  await server.start();
  console.log('Server running on %s', server.info.uri);
};

process.on('unhandledRejection', (err) => {
  console.log(err);
  process.exit(1);
});

init();
