import express from 'express';
import { AppDataSource } from '../database.js';
import { requireUser } from '../middleware/auth.js';

const router = express.Router();
router.use(requireUser);

// GET /api/face-config - Get all face recognition configuration
router.get('/', async (req, res) => {
  try {
    const result = await AppDataSource.query(
      `SELECT config_key, config_value, description, category, is_active, updated_at
       FROM face_recognition_config
       WHERE is_active = true
       ORDER BY category, config_key`
    );

    const config = result.reduce((acc: any, row: any) => {
      acc[row.config_key] = {
        value: row.config_value.value || row.config_value.algorithm,
        ...row.config_value,
        description: row.description,
        category: row.category,
        updatedAt: row.updated_at
      };
      return acc;
    }, {});

    res.json(config);
  } catch (error) {
    console.error('Error fetching face config:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

// GET /api/face-config/:key - Get specific configuration value
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;

    const result = await AppDataSource.query(
      `SELECT config_key, config_value, description, category, updated_at
       FROM face_recognition_config
       WHERE config_key = $1 AND is_active = true`,
      [key]
    );

    if (result.length === 0) {
      return res.status(404).json({ error: 'Configuration key not found' });
    }

    const row = result[0];
    res.json({
      key: row.config_key,
      value: row.config_value.value || row.config_value.algorithm,
      ...row.config_value,
      description: row.description,
      category: row.category,
      updatedAt: row.updated_at
    });
  } catch (error) {
    console.error('Error fetching config key:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

// PUT /api/face-config/:key - Update configuration value
router.put('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }

    // Get current config to validate
    const current = await AppDataSource.query(
      `SELECT config_value, category FROM face_recognition_config
       WHERE config_key = $1 AND is_active = true`,
      [key]
    );

    if (current.length === 0) {
      return res.status(404).json({ error: 'Configuration key not found' });
    }

    const configValue = current[0].config_value;

    // Validate against constraints
    if (configValue.min !== undefined && value < configValue.min) {
      return res.status(400).json({
        error: `Value must be >= ${configValue.min}`
      });
    }

    if (configValue.max !== undefined && value > configValue.max) {
      return res.status(400).json({
        error: `Value must be <= ${configValue.max}`
      });
    }

    // Update configuration
    const newConfigValue = { ...configValue, value };
    await AppDataSource.query(
      `UPDATE face_recognition_config
       SET config_value = $1, updated_at = CURRENT_TIMESTAMP
       WHERE config_key = $2`,
      [JSON.stringify(newConfigValue), key]
    );

    // Log configuration change
    await AppDataSource.query(
      `INSERT INTO audit_logs (user_id, action, details, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [
        null, // System change
        'face_config_update',
        JSON.stringify({ key, oldValue: configValue.value, newValue: value }),
        req.ip || 'system'
      ]
    );

    res.json({
      key,
      value,
      message: 'Configuration updated successfully'
    });
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// POST /api/face-config/reset - Reset all configuration to defaults
router.post('/reset', async (req, res) => {
  try {
    await AppDataSource.query(`
      UPDATE face_recognition_config
      SET config_value = default_values,
          updated_at = CURRENT_TIMESTAMP
      FROM (
        SELECT '{"value": 0.6, "min": 0.3, "max": 0.8, "step": 0.05}'::jsonb AS default_values
        WHERE config_key = 'similarity_threshold'
        UNION ALL
        SELECT '{"algorithm": "cosine", "fallback": "euclidean"}'::jsonb
        WHERE config_key = 'comparison_algorithm'
        UNION ALL
        SELECT '{"value": 60, "min": 0, "max": 100}'::jsonb
        WHERE config_key = 'min_face_quality'
        UNION ALL
        SELECT '{"value": 10, "min": 1, "max": 50}'::jsonb
        WHERE config_key = 'max_embeddings_per_visitor'
      ) AS defaults
      WHERE face_recognition_config.config_key = defaults.config_key
    `);

    res.json({ message: 'Configuration reset to defaults' });
  } catch (error) {
    console.error('Error resetting config:', error);
    res.status(500).json({ error: 'Failed to reset configuration' });
  }
});

export default router;
