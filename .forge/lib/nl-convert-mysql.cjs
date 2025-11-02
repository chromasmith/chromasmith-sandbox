// Ntendril MySQL Schema Converter
// Converts Postgres/Supabase schemas to MySQL-compatible migrations

const fs = require('fs').promises;
const path = require('path');

class MySQLConverter {
  constructor() {
    this.typeMap = {
      'uuid': 'CHAR(36)',
      'text': 'TEXT',
      'varchar': 'VARCHAR',
      'timestamp': 'DATETIME',
      'timestamptz': 'DATETIME',
      'boolean': 'TINYINT(1)',
      'integer': 'INT',
      'bigint': 'BIGINT',
      'jsonb': 'JSON',
      'json': 'JSON'
    };
  }
  
  convertType(postgresType) {
    const baseType = postgresType.toLowerCase().split('(')[0];
    return this.typeMap[baseType] || postgresType.toUpperCase();
  }
  
  convertConstraint(constraint) {
    // Convert Postgres constraints to MySQL
    return constraint
      .replace(/USING INDEX TABLESPACE/gi, '-- USING INDEX TABLESPACE')
      .replace(/WITH \(fillfactor = \d+\)/gi, '');
  }
  
  async convertMigration(postgresSQL) {
    let mysqlSQL = postgresSQL;
    
    // Convert CREATE TABLE syntax
    mysqlSQL = this.convertCreateTable(mysqlSQL);
    
    // Convert data types
    for (const [pgType, mysqlType] of Object.entries(this.typeMap)) {
      const regex = new RegExp(`\\b${pgType}\\b`, 'gi');
      mysqlSQL = mysqlSQL.replace(regex, mysqlType);
    }
    
    // Convert sequences to AUTO_INCREMENT
    mysqlSQL = this.convertSequences(mysqlSQL);
    
    // Convert constraints
    mysqlSQL = this.convertConstraint(mysqlSQL);
    
    // Add MySQL-specific settings
    mysqlSQL = this.addMySQLSettings(mysqlSQL);
    
    return mysqlSQL;
  }
  
  convertCreateTable(sql) {
    // Handle UUID primary keys
    sql = sql.replace(
      /id\s+uuid\s+DEFAULT\s+gen_random_uuid\(\)\s+PRIMARY KEY/gi,
      'id CHAR(36) PRIMARY KEY'
    );
    
    // Handle SERIAL types
    sql = sql.replace(/SERIAL PRIMARY KEY/gi, 'INT AUTO_INCREMENT PRIMARY KEY');
    sql = sql.replace(/BIGSERIAL PRIMARY KEY/gi, 'BIGINT AUTO_INCREMENT PRIMARY KEY');
    
    return sql;
  }
  
  convertSequences(sql) {
    // Remove sequence creation statements (not needed in MySQL)
    sql = sql.replace(/CREATE SEQUENCE[^;]+;/gi, '-- Sequence converted to AUTO_INCREMENT');
    
    return sql;
  }
  
  addMySQLSettings(sql) {
    // Add table engine and charset
    sql = sql.replace(
      /CREATE TABLE (\w+)/gi,
      'CREATE TABLE $1'
    );
    
    // Add ENGINE and CHARSET to each CREATE TABLE
    const lines = sql.split('\n');
    const result = [];
    
    for (let i = 0; i < lines.length; i++) {
      result.push(lines[i]);
      
      if (lines[i].trim().endsWith(');') && i > 0) {
        // Check if previous lines contain CREATE TABLE
        const prevLines = lines.slice(Math.max(0, i - 20), i + 1).join('\n');
        if (prevLines.includes('CREATE TABLE')) {
          result[result.length - 1] = result[result.length - 1].replace(
            /\);$/,
            ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;'
          );
        }
      }
    }
    
    return result.join('\n');
  }
  
  async convertFile(inputPath, outputPath) {
    const content = await fs.readFile(inputPath, 'utf8');
    const converted = await this.convertMigration(content);
    await fs.writeFile(outputPath, converted, 'utf8');
    
    return {
      input: inputPath,
      output: outputPath,
      conversions: this.countConversions(content, converted)
    };
  }
  
  countConversions(original, converted) {
    const counts = {
      types: 0,
      sequences: 0,
      constraints: 0
    };
    
    for (const pgType of Object.keys(this.typeMap)) {
      const regex = new RegExp(`\\b${pgType}\\b`, 'gi');
      const matches = original.match(regex);
      if (matches) counts.types += matches.length;
    }
    
    const seqMatches = original.match(/CREATE SEQUENCE/gi);
    if (seqMatches) counts.sequences = seqMatches.length;
    
    return counts;
  }
}

module.exports = { MySQLConverter };