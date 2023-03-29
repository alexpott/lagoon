import * as R from 'ramda';
import { query } from '../../util/db';
import { Sql } from './sql';
import { Helpers as problemHelpers } from './helpers';
import { Helpers as environmentHelpers } from '../environment/helpers';
import { ResolverFn } from '../';
import { logger } from '../../loggers/logger';

export const getAllProblems: ResolverFn = async (
  root,
  args,
  { sqlClientPool, hasPermission }
) => {
  let rows = [];

  try {
    if (!R.isEmpty(args)) {
      rows = await problemHelpers(sqlClientPool).getAllProblems(
        args.source,
        args.environment,
        args.envType,
        args.severity
      );
    } else {
      rows = await query(
        sqlClientPool,
        Sql.selectAllProblems({
          source: [],
          environmentId: 0,
          environmentType: [],
          severity: []
        })
      );
    }
  } catch (err) {
    if (err) {
      logger.warn(`getAllProblems: ${err.message}`);
      return [];
    }
  }

  const problems: any =
    rows &&
    rows.map(async problem => {
      const {
        environment: envId,
        name,
        project,
        environmentType,
        openshiftProjectName,
        ...rest
      } = problem;

      await hasPermission('problem', 'view', {
        project: project
      });

      return {
        ...rest,
        environment: {
          id: envId,
          name,
          project,
          environmentType,
          openshiftProjectName
        }
      };
    });

  return Promise.all(problems).then(completed => {
    const sorted = R.sort(R.descend(R.prop('severity')), completed);
    return sorted.map((row: any) => ({ ...(row as Object) }));
  });
};

export const getSeverityOptions: ResolverFn = async (
  root,
  args,
  { sqlClientPool }
) => {
  return await problemHelpers(sqlClientPool).getSeverityOptions();
};

export const getProblemSources: ResolverFn = async (
  root,
  args,
  { sqlClientPool }
) => {
  return R.map(
    R.prop('source'),
    await query(
      sqlClientPool,
      'SELECT DISTINCT source FROM environment_problem'
    )
  );
};

export const getProblemsByEnvironmentId: ResolverFn = async (
  { id: environmentId },
  { severity, source },
  { sqlClientPool, hasPermission }
) => {
  const environment = await environmentHelpers(
    sqlClientPool
  ).getEnvironmentById(environmentId);

  await hasPermission('problem', 'view', {
    project: environment.project
  });

  const rows = await query(
    sqlClientPool,
    Sql.selectProblemsByEnvironmentId({
      environmentId,
      severity,
      source
    })
  );

  return R.sort(R.descend(R.prop('created')), rows);
};

export const addProblem: ResolverFn = async (
  root,
  {
    input: {
      severity,
      environment: environmentId,
      identifier,
      service,
      source,
      data,
      created,
      severityScore,
      associatedPackage,
      description,
      version,
      fixedVersion,
      links
    }
  },
  { sqlClientPool, hasPermission, userActivityLogger },
) => {
  const environment = await environmentHelpers(
    sqlClientPool
  ).getEnvironmentById(environmentId);

  await hasPermission('problem', 'add', {
    project: environment.project
  });

  const { insertId } = await query(
    sqlClientPool,
    Sql.insertProblem({
      severity,
      severity_score: severityScore,
      lagoon_service: service || '',
      identifier,
      environment: environmentId,
      source,
      associated_package: associatedPackage,
      description,
      version: version || '',
      fixed_version: fixedVersion,
      links: links,
      data,
      created
    })
  );

  const rows = await query(
    sqlClientPool,
    Sql.selectProblemByDatabaseId(insertId)
  );

  userActivityLogger(`User added a problem to environment '${environment.name}' for '${environment.project}'`, {
    project: '',
    event: 'api:addProblem',
    payload: {
      input: {
        severity,
        severity_score: severityScore,
        lagoon_service: service || '',
        identifier,
        environment: environmentId,
        source,
        associated_package: associatedPackage,
        description,
        version: version || '',
        fixed_version: fixedVersion,
        links: links,
        data,
        created,
      }
    }
  });

  return R.prop(0, rows);
};

export const addProblems: ResolverFn = async (
  root,
  { input: { problems } },
  { sqlClientPool, hasPermission, userActivityLogger }
) => {
  const environments = problems.reduce((environmentList, problem) => {
    if (problem.environment == undefined) {
      logger.error(`No environment ID given for problem: ${problem.identifier}`);
      throw new Error(`No environment ID given for problem: ${problem.identifier}`);
    }

    let { environment } = problem;
    if (!environmentList.includes(environment)) {
      environmentList.push(environment);
    }
    return environmentList;
  }, []);

  for (let i = 0; i < environments.length; i++) {
    const env = await environmentHelpers(sqlClientPool).getEnvironmentById(
      environments[i]
    );
    await hasPermission('problem', 'add', {
      project: env.project
    });
  };

  const problemsArr = [];
  for (let i = 0; i < problems.length; i++) {
    const {
      severity,
      severity_score: severity_score,
      service: lagoon_service,
      identifier,
      environment,
      source,
      associatedPackage: associated_package,
      description,
      version: version,
      fixedVersion: fixed_version,
      links: links,
      data,
      created
    } = problems[i];

    const {
      insertId
    } = await query(
      sqlClientPool,
      Sql.insertProblem({
        severity, severity_score, lagoon_service, identifier, environment, source, associated_package,
        description, version, fixed_version, links, data, created
      })
    );

    const rows = await query(
      sqlClientPool,
      Sql.selectProblemByDatabaseId(insertId)
    );

    problemsArr.push(R.prop(0, rows));
  }

  userActivityLogger(`User added problems to environments'`, {
    project: '',
    event: 'api:addProblems',
    payload: {
      data: {
        problemsArr
      }
    }
  });

  return problemsArr;
};

export const deleteProblem: ResolverFn = async (
  root,
  { input: { environment: environmentId, identifier } },
  { sqlClientPool, hasPermission, userActivityLogger }
) => {
  const environment = await environmentHelpers(
    sqlClientPool
  ).getEnvironmentById(environmentId);

  await hasPermission('problem', 'delete', {
    project: environment.project
  });

  await query(sqlClientPool, Sql.deleteProblem(environmentId, identifier));

  userActivityLogger(`User deleted a problem on environment '${environment.name}' for '${environment.project}'`, {
    project: '',
    event: 'api:deleteProblem',
    payload: {
      input: { environment, identifier }
    }
  });

  return 'success';
};

export const deleteProblemsFromSource: ResolverFn = async (
  root,
  { input: { environment: environmentId, source, service } },
  { sqlClientPool, hasPermission, userActivityLogger }
) => {
  const environment = await environmentHelpers(
    sqlClientPool
  ).getEnvironmentById(environmentId);

  await hasPermission('problem', 'delete', {
    project: environment.project
  });

  await query(
    sqlClientPool,
    Sql.deleteProblemsFromSource(environmentId, source, service)
  );

  userActivityLogger(`User deleted problems on environment '${environment.id}' for source '${source}'`, {
    project: '',
    event: 'api:deleteProblemsFromSource',
    payload: {
      input: { environment, source, service }
    }
  });

  return 'success';
};

export const getProblemHarborScanMatches: ResolverFn = async (
  root,
  args,
  { sqlClientPool, hasPermission }
) => {
  await hasPermission('harbor_scan_match', 'view', {});

  const rows = await query(
    sqlClientPool,
    Sql.selectAllProblemHarborScanMatches()
  );

  return rows;
};

export const addProblemHarborScanMatch: ResolverFn = async (
  root,
  {
    input: {
      name,
      description,
      defaultLagoonProject,
      defaultLagoonEnvironment,
      defaultLagoonService,
      regex
    }
  },
  { sqlClientPool, hasPermission, userActivityLogger }
) => {
  await hasPermission('harbor_scan_match', 'add', {});

  const { insertId } = await query(
    sqlClientPool,
    Sql.insertProblemHarborScanMatch({
      id: null,
      name,
      description,
      default_lagoon_project: defaultLagoonProject,
      default_lagoon_environment: defaultLagoonEnvironment,
      default_lagoon_service_name: defaultLagoonService,
      regex
    })
  );

  const rows = await query(
    sqlClientPool,
    Sql.selectAllProblemHarborScanMatchByDatabaseId(insertId)
  );

  userActivityLogger(`User added harbor scan regex matcher`, {
    project: '',
    event: 'api:addProblemHarborScanMatch',
    payload: {
      input: {
        name,
        description,
        defaultLagoonProject,
        defaultLagoonEnvironment,
        defaultLagoonService,
        regex
      }
    }
  });

  return R.prop(0, rows);
};

export const deleteProblemHarborScanMatch: ResolverFn = async (
  root,
  { input: { id } },
  { sqlClientPool, hasPermission, userActivityLogger }
) => {
  await hasPermission('harbor_scan_match', 'delete', {});

  await query(sqlClientPool, Sql.deleteProblemHarborScanMatch(id));

  userActivityLogger(`User deleted harbor scan regex matcher`, {
    project: '',
    event: 'api:deleteProblemHarborScanMatch',
    payload: {
      input: { id }
    }
  });

  return 'success';
};
