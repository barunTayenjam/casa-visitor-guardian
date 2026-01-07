    // Query database to get storage path for this filename
    const query = `
      SELECT storage_path
      FROM detection_files
      WHERE original_filename = $1
        AND file_type = 'snapshot'
        AND is_deleted = FALSE
      LIMIT 1
    `;

    const results = await AppDataSource.query(query, [req.params.filename]);

    if (results.length === 0) {
      // If not found in database, try direct filesystem access
      const directPath = path.join(process.cwd(), 'data/detections', req.params.filename.split('/')[0].split('_')[1].split('_')[0], 'snapshots', req.params.filename);
      
      if (fs.existsSync(directPath)) {
        return res.sendFile(directPath);
      }
      
      return res.status(404).json({ success: false, error: 'Image not found' });
    }

    let imagePath = results[0].storage_path;
