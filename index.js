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
  database: 'restoapi1',
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
    port: 3014,
    host: 'localhost',
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
    path: '/detail/{restoId}',
    handler: async (request, h) => {
      try {
        const { restoId } = request.params;

        const restaurant = await new Promise((resolve, reject) => {
          connection.query('SELECT * FROM restaurants WHERE restoId = ?', [restoId], (error, results, fields) => {
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
            connection.query('SELECT * FROM customerReviews WHERE restoId = ?', [restoId], (error, results, fields) => {
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
          name, description, city, address, id, rating,
        } = request.payload;
        const restoId = uuid.v4();
        await connection.query(
          'INSERT INTO restaurants (restoId, name, description, city, address, id, rating) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, name, description, city, address, id, rating],
        );
        return {
          error: false,
          message: 'Restaurant added successfully',
          restaurant: {
            restoId, name, description, city, address, id, rating,
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
          id: Joi.string().required(),
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
    path: '/restaurants/{restoId}',
    handler: async (request, h) => {
      try {
        const { restoId } = request.params;
        await connection.query('DELETE FROM restaurants WHERE restoId = ?', [restoId]);
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
    path: '/restaurants/{restoId}',
    handler: async (request, h) => {
      try {
        const { restoId } = request.params;
        const {
          name, description, city, address, id, rating,
        } = request.payload;
        await connection.query(
          'UPDATE restaurants SET name = ?, description = ?, city = ?, address = ?, id = ?, rating = ? WHERE restoId = ?',
          [name, description, city, address, id, rating, restoId],
        );
        return {
          error: false,
          message: 'Restaurant updated successfully',
          restaurant: {
            restoId, name, description, city, address, id, rating,
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
          id: Joi.string().required(),
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
        const { restoId, name, review } = request.payload;
        // const id = uuid.v4();
        const restaurantDetail = await connection.query(
          'SELECT restoId FROM restaurants WHERE restoId = ?',
          [restoId],
        );
        if (restaurantDetail.length === 0) {
          return h.response({ error: true, message: 'Restaurant not found' }).code(404);
        }
        await connection.query(
          'INSERT INTO customerReviews (restoId, name, review, date) VALUES (?, ?, ?, NOW())',
          [restoId, name, review],
        );

        return {
          error: false,
          message: 'Customer review added successfully',
          review: {
            restoId,
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
          restoId: Joi.string().required(),
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
