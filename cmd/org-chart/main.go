package main

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"strings"

	"github.com/davecgh/go-spew/spew"

	"golang.org/x/oauth2"

	"github.com/sirupsen/logrus"

	"github.com/google/go-github/github"
	"github.com/pkg/errors"

	"github.com/lancecarlson/couchgo"

	"gopkg.in/urfave/cli.v1"
)

func main() {

	app := cli.NewApp()

	app.Name = "org-chart management"

	app.Commands = []cli.Command{
		{
			Name: "gh-sync",
			Flags: []cli.Flag{
				cli.StringFlag{
					Name: "data-url",
				},
				cli.StringFlag{
					Name:   "github-token",
					EnvVar: "GITHUB_TOKEN",
				},
				cli.StringFlag{
					Name: "github-org",
				},
				cli.StringFlag{
					Name:  "github-team-prefix",
					Value: "org-",
				},
				cli.BoolFlag{
					Name: "dry-run",
				},
			},
			Action: func(c *cli.Context) error {

				orgChart, err := loadOrgChartData(c.String("data-url"))

				if err != nil {
					return errors.Wrap(err, "retrieving org chart data")
				}

				for _, t := range orgChart.Teams {
					t.Github = fmt.Sprintf("%s%s", c.String("github-team-prefix"), strings.Replace(t.ID, "_", "-", -1))
				}

				gh, err := newGithubState(c.String("github-token"), c.String("github-org"), c.String("github-team-prefix"))

				if err != nil {
					return errors.Wrap(err, "retrieving github data")
				}

				for _, m := range githubMembersNotInOrgchart(orgChart, gh) {
					logrus.Infof("github user %s not found in orgchart", m.GetLogin())
				}

				for _, m := range employeesNotInGithub(orgChart, gh) {
					logrus.Infof("employee %s (%s) not found in github, will be added", m.Name, m.Github)
				}

				for _, t := range githubTeamsNotInOrgchart(orgChart, gh) {
					logrus.Infof("github team %s not found in orgchart, will be removed", t.GetName())
				}

				for _, m := range teamsNotInGithub(orgChart, gh) {
					logrus.Infof("team %s (%s) not found in github, will be added", m.Name, m.Github)
				}

				result, err := gh.SyncTeams(orgChart)

				if err != nil {
					return errors.Wrap(err, "syncing teams")
				}

				spew.Dump(result)

				/*

					for _, t := range ghTeams {
						if ghTeamInOrgChart(orgChart, t, c.String("github-team-prefix")) == false {
							logrus.Infof("github team %s not found in orgchart, will be removed", t.GetName())
						}
					}

					err = syncTeamsInGithub(orgChart.Teams, ghTeams, "new-org", c.String("github-org"), ghClient)

					if err != nil {
						return errors.Wrap(err, "syncing teams to github")
					}*/

				return nil

			},
		},
	}

	err := app.Run(os.Args)

	if err != nil {
		logrus.Fatal(err)
	}

}

type Employee struct {
	Name     string
	Github   string
	MemberOf string
}

type Team struct {
	ID          string
	Name        string
	ParentID    string `json:"parent"`
	Description string
	Github      string
}

type OrgChart struct {
	Employees []*Employee
	Teams     []*Team
}

func employeesNotInGithub(orgchart *OrgChart, gh *GithubState) []*Employee {

	notInGithub := []*Employee{}

	for _, employee := range orgchart.Employees {
		if employee.Github == "" {
			continue
		}

		found := false

		for _, ghMember := range gh.members {
			if employee.Github == ghMember.GetLogin() {
				found = true
				break
			}
		}

		if !found {
			notInGithub = append(notInGithub, employee)
		}
	}

	return notInGithub
}

func githubMembersNotInOrgchart(orgchart *OrgChart, gh *GithubState) []*github.User {
	notInOrgchart := []*github.User{}

	for _, ghMember := range gh.members {
		found := false
		for _, employee := range orgchart.Employees {
			if employee.Github == ghMember.GetLogin() {
				found = true
				break
			}
		}
		if !found {
			notInOrgchart = append(notInOrgchart, ghMember)
		}
	}

	return notInOrgchart
}

func teamsNotInGithub(orgchart *OrgChart, gh *GithubState) []*Team {

	notInGithub := []*Team{}

	for _, team := range orgchart.Teams {

		found := false

		for _, ghTeam := range gh.teams {
			if team.Github == ghTeam.GetName() {
				found = true
				break
			}
		}

		if !found {
			notInGithub = append(notInGithub, team)
		}
	}

	return notInGithub

}

func githubTeamsNotInOrgchart(orgchart *OrgChart, gh *GithubState) []*github.Team {
	notInOrgchart := []*github.Team{}

	for _, ghTeam := range gh.teams {
		found := false
		for _, team := range orgchart.Teams {
			if team.Github == ghTeam.GetName() {
				found = true
				break
			}
		}
		if !found {
			notInOrgchart = append(notInOrgchart, ghTeam)
		}
	}

	return notInOrgchart
}

func newGithubState(token, organisation, teamPrefix string) (*GithubState, error) {

	client := newGitHubClient(token)

	gh := &GithubState{
		organisation: organisation,
		teamPrefix:   teamPrefix,
		client:       client,
		teams:        make(map[string]*github.Team),
		members:      []*github.User{},
	}

	ctx := context.Background()

	memberOpt := &github.ListMembersOptions{
		ListOptions: github.ListOptions{PerPage: 500},
	}

	for {
		members, res, err := client.Organizations.ListMembers(ctx, organisation, memberOpt)

		if err != nil {
			return nil, err
		}

		gh.AddMembers(members...)

		if res.NextPage == 0 {
			break
		}

		memberOpt.Page = res.NextPage
	}

	teamsOpt := &github.ListOptions{PerPage: 500}

	for {
		teams, res, err := client.Teams.ListTeams(ctx, organisation, teamsOpt)

		if err != nil {
			return nil, err
		}

		for _, t := range teams {
			if strings.HasPrefix(t.GetName(), teamPrefix) {
				gh.AddTeam(t)
			}
		}

		if res.NextPage == 0 {
			break
		}

		teamsOpt.Page = res.NextPage
	}

	return gh, nil
}

type GithubState struct {
	organisation string
	teamPrefix   string
	client       *github.Client
	teams        map[string]*github.Team
	members      []*github.User
}

func (gh *GithubState) AddTeam(team *github.Team) {
	gh.teams[team.GetName()] = team
}

func (gh *GithubState) AddMembers(member ...*github.User) {
	gh.members = append(gh.members, member...)
}

func (gh *GithubState) SyncTeams(chart *OrgChart) (error, error) {

	// find teams that are not in github
	// find teams that shouldn't be in github

	// remove temans that shouldn't be in github

	// start creating teams recursively with parents

	// report back

	// sort out members

	return nil, nil

}

func newGitHubClient(token string) *github.Client {
	ts := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: token},
	)

	ctx := context.Background()

	tc := oauth2.NewClient(ctx, ts)

	return github.NewClient(tc)
}

func loadOrgChartData(location string) (*OrgChart, error) {

	URL, err := url.Parse(location)

	if err != nil {
		return nil, err
	}

	var chart OrgChart

	couchdb := couch.NewClient(URL)

	err = couchdb.Get("chart", &chart)

	if err != nil {
		return nil, err
	}

	return &chart, nil

}
