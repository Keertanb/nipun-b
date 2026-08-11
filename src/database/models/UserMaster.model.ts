import {
	Table,
	Column,
	Model,
	DataType,
	AllowNull,
	PrimaryKey,
} from 'sequelize-typescript';

/**
 * External verifier credentials + assigned school.
 * Columns are lowercase as created in Postgres (user_master).
 */
@Table({ tableName: 'user_master', timestamps: false, underscored: false })
export class UserMaster extends Model {
	@AllowNull(true)
	@Column({ field: 'districtid', type: DataType.INTEGER })
	districtId!: number | null;

	@AllowNull(true)
	@Column({ field: 'districtname', type: DataType.STRING })
	districtName!: string | null;

	@AllowNull(true)
	@Column({ field: 'blockid', type: DataType.INTEGER })
	blockId!: number | null;

	@AllowNull(true)
	@Column({ field: 'blockname', type: DataType.STRING })
	blockName!: string | null;

	@PrimaryKey
	@AllowNull(false)
	@Column({ field: 'clusterid', type: DataType.BIGINT })
	clusterId!: string;

	@AllowNull(true)
	@Column({ field: 'clustername', type: DataType.STRING })
	clusterName!: string | null;

	@AllowNull(false)
	@Column({ field: 'schoolid', type: DataType.STRING })
	schoolId!: string;

	@AllowNull(true)
	@Column({ field: 'schoolname', type: DataType.STRING })
	schoolName!: string | null;

	@AllowNull(true)
	@Column({ field: 'balvatikacount', type: DataType.INTEGER })
	balvatikaCount!: number | null;

	@AllowNull(true)
	@Column({ field: 'class1count', type: DataType.INTEGER })
	class1Count!: number | null;

	@AllowNull(true)
	@Column({ field: 'class2count', type: DataType.INTEGER })
	class2Count!: number | null;

	@AllowNull(true)
	@Column({ field: 'class3count', type: DataType.INTEGER })
	class3Count!: number | null;

	@AllowNull(true)
	@Column({ field: 'class4count', type: DataType.INTEGER })
	class4Count!: number | null;

	@AllowNull(true)
	@Column({ field: 'class5count', type: DataType.INTEGER })
	class5Count!: number | null;

	@AllowNull(true)
	@Column({ field: 'totalstudentcount', type: DataType.INTEGER })
	totalStudentCount!: number | null;

	@AllowNull(false)
	@Column({ field: 'password', type: DataType.STRING })
	password!: string;

	@AllowNull(true)
	@Column({ field: 'email', type: DataType.STRING })
	email!: string | null;
}

export default UserMaster;
